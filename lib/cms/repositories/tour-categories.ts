import "server-only";

import { ConflictError, NotFoundError } from "@/lib/cms/errors";
import { getDatabase } from "@/lib/database";
import { slugify } from "@/schemas/common";
import type {
  QuickTourCategoryInput,
  TourCategoryInputParsed,
} from "@/schemas/tour-category";
import type { ListOptions, Paginated } from "@/types/common";
import type { TourCategory } from "@/types/content";
import { EMPTY_SEO } from "@/types/seo";

import {
  buildListQuery,
  isPubliclyVisible,
  PUBLIC_STATUS_FILTER,
  resolvePublication,
} from "./base";
import type { WriteContext } from "./pages";

const SEARCH_FIELDS = ["name", "slug", "description"];

/** Ceiling for the unpaginated scans. See the note on `media.folders()`. */
const FACET_SCAN_LIMIT = 2000;

async function collection() {
  return (await getDatabase()).collection<TourCategory>("tour_categories");
}

export interface TourCategoryListOptions extends ListOptions {
  featured?: boolean;
}

/**
 * Trip categories repository.
 *
 * The commercial tier a trip is sold under — Luxury, VIP, Budget. Shaped like
 * `activities`: a label a tour is tagged with, carrying a slug and a
 * publication lifecycle of its own.
 *
 * Slugs are bare. Nothing mounts a category route today, so the slug exists to
 * keep that option open and to give the list a stable human-readable key.
 */
export const tourCategories = {
  async list(
    options?: TourCategoryListOptions,
  ): Promise<Paginated<TourCategory>> {
    const store = await collection();
    const query = buildListQuery(options, SEARCH_FIELDS);

    const where = [...(query.where ?? [])];
    if (options?.featured !== undefined) {
      where.push({ field: "featured", op: "eq", value: options.featured });
    }

    return store.list({ ...query, where });
  },

  async get(id: string): Promise<TourCategory | null> {
    return (await collection()).findById(id);
  },

  /** Frontend lookup. Drafts and not-yet-due scheduled records return null. */
  async getBySlug(slug: string): Promise<TourCategory | null> {
    const found = await this.getBySlugIncludingDrafts(slug);
    return found && isPubliclyVisible(found) ? found : null;
  },

  /** Preview/admin lookup: ignores publication state. */
  async getBySlugIncludingDrafts(slug: string): Promise<TourCategory | null> {
    const store = await collection();
    return store.findOne({
      where: [{ field: "slug", op: "eq", value: slugify(slug) }],
    });
  },

  /** Published categories in display order. */
  async getPublished(options?: ListOptions): Promise<TourCategory[]> {
    const store = await collection();

    const candidates = await store.findMany({
      where: [PUBLIC_STATUS_FILTER],
      sort: [
        { field: options?.sort ?? "order", direction: options?.order ?? "asc" },
      ],
    });

    const visible = candidates.filter((record) => isPubliclyVisible(record));
    return options?.perPage ? visible.slice(0, options.perPage) : visible;
  },

  /** The featured set, for a homepage strip. */
  async getFeatured(limit = 6): Promise<TourCategory[]> {
    const published = await this.getPublished();
    return published.filter((record) => record.featured).slice(0, limit);
  },

  async count(options?: TourCategoryListOptions): Promise<number> {
    const store = await collection();
    return store.count(buildListQuery(options, SEARCH_FIELDS));
  },

  /** Minimal projection, for the category picker in the tour editor. */
  async options(): Promise<{ id: string; name: string; slug: string }[]> {
    const store = await collection();
    const all = await store.findMany({
      where: [{ field: "status", op: "ne", value: "trash" }],
      sort: [{ field: "name", direction: "asc" }],
      limit: FACET_SCAN_LIMIT,
    });

    return all.map(({ id, name, slug }) => ({ id, name, slug }));
  },

  /**
   * Resolves the ids a tour stores, in the order the tour stores them.
   *
   * Stale ids are dropped rather than reported, for the same reason as
   * `activities.byIds`: nothing rewrites a tour when a category is deleted.
   */
  async byIds(ids: string[]): Promise<TourCategory[]> {
    if (ids.length === 0) return [];

    const store = await collection();
    const found = await store.findMany({
      where: [{ field: "id", op: "in", value: ids }],
      limit: FACET_SCAN_LIMIT,
    });

    const byId = new Map(found.map((record) => [record.id, record]));
    return ids
      .map((id) => byId.get(id))
      .filter((record): record is TourCategory => record !== undefined);
  },

  async create(
    input: TourCategoryInputParsed,
    ctx: WriteContext,
  ): Promise<TourCategory> {
    const store = await collection();
    await assertSlugFree(input.slug, null);

    return store.create({
      ...fields(input),
      publishedAt: resolvePublication(input.status, input.publishedAt, null),
      updatedBy: ctx.userId,
    });
  },

  /**
   * Creates a category from the tour editor's inline control.
   *
   * Pinned to `draft` rather than taking a status from the caller: this path
   * exists so that tagging a trip does not mean leaving the editor, and a tier
   * with no description or image is not something to put in front of a
   * visitor. Whoever holds `tourCategories.publish` promotes it later from the
   * real editor.
   *
   * A slug that is already taken returns the existing record instead of
   * throwing. The editor is trying to tag a trip, and "Luxury already exists"
   * is a worse answer than ticking the Luxury that is already there.
   */
  async quickCreate(
    input: QuickTourCategoryInput,
    ctx: WriteContext,
  ): Promise<TourCategory> {
    const store = await collection();

    const existing = await store.findOne({
      where: [{ field: "slug", op: "eq", value: input.slug }],
    });
    if (existing) return existing;

    return store.create({
      name: input.name,
      slug: input.slug,
      description: "",
      featuredImage: "",
      featuredImageHorizontal: "",
      featuredImageVertical: "",
      bannerImage: "",
      gallery: [],
      featured: false,
      order: 0,
      status: "draft",
      publishedAt: null,
      seo: EMPTY_SEO,
      updatedBy: ctx.userId,
    });
  },

  async update(
    id: string,
    input: TourCategoryInputParsed,
    ctx: WriteContext,
  ): Promise<TourCategory> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Trip category");

    await assertSlugFree(input.slug, id);

    const updated = await store.update(id, {
      ...fields(input),
      publishedAt: resolvePublication(
        input.status,
        input.publishedAt,
        existing.publishedAt,
      ),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Trip category");
    return updated;
  },

  async setStatus(
    id: string,
    status: TourCategory["status"],
    ctx: WriteContext,
  ): Promise<TourCategory> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Trip category");

    const updated = await store.update(id, {
      status,
      publishedAt: resolvePublication(status, null, existing.publishedAt),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Trip category");
    return updated;
  },

  async trash(id: string, ctx: WriteContext): Promise<TourCategory> {
    return this.setStatus(id, "trash", ctx);
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },

  async duplicate(id: string, ctx: WriteContext): Promise<TourCategory> {
    const store = await collection();
    const source = await store.findById(id);
    if (!source) throw new NotFoundError("Trip category");

    return store.create({
      ...source,
      id: undefined,
      name: `${source.name} (copy)`,
      slug: await findFreeSlug(source.slug),
      status: "draft",
      publishedAt: null,
      updatedBy: ctx.userId,
    } as Omit<TourCategory, "id" | "createdAt" | "updatedAt"> & { id?: string });
  },
};

/** The fields the form owns, shared by create and update. */
function fields(input: TourCategoryInputParsed) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    featuredImage: input.featuredImage,
    featuredImageHorizontal: input.featuredImageHorizontal,
    featuredImageVertical: input.featuredImageVertical,
    bannerImage: input.bannerImage,
    gallery: input.gallery,
    featured: input.featured,
    order: input.order,
    status: input.status,
    seo: input.seo,
  };
}

async function assertSlugFree(slug: string, ignoreId: string | null) {
  const store = await collection();
  const existing = await store.findOne({
    where: [{ field: "slug", op: "eq", value: slug }],
  });

  if (existing && existing.id !== ignoreId) {
    throw new ConflictError(
      `The slug "${slug}" is already used by "${existing.name}".`,
      "slug",
    );
  }
}

async function findFreeSlug(base: string): Promise<string> {
  const store = await collection();

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = slugify(`${base}-${suffix}`);
    const taken = await store.findOne({
      where: [{ field: "slug", op: "eq", value: candidate }],
    });
    if (!taken) return candidate;
  }

  return slugify(`${base}-${Date.now()}`);
}
