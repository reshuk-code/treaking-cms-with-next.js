import "server-only";

import { ConflictError, NotFoundError } from "@/lib/cms/errors";
import { getDatabase } from "@/lib/database";
import { slugify } from "@/schemas/common";
import type { RegionInputParsed } from "@/schemas/region";
import type { FilterCondition, ListOptions, Paginated } from "@/types/common";
import type { Region } from "@/types/content";
import { EMPTY_SEO } from "@/types/seo";

import {
  buildListQuery,
  isPubliclyVisible,
  PUBLIC_STATUS_FILTER,
  resolvePublication,
} from "./base";
import type { WriteContext } from "./pages";

const SEARCH_FIELDS = ["name", "slug"];

/** Ceiling for an unpaginated scan. See the note on `media.folders()`. */
const FACET_SCAN_LIMIT = 2000;

async function collection() {
  return (await getDatabase()).collection<Region>("regions");
}

export interface RegionListOptions extends ListOptions {
  featured?: boolean;
}

/**
 * Regions repository.
 *
 * The area a trip happens in — Everest, Annapurna — one level above a
 * destination. It is a content type rather than a taxonomy because a region
 * sells: it carries photographs, prose and its own page.
 *
 * It does **not** own `Destination.region`, which stays free text. Making that
 * a reference would rewrite a field eight display sites already read, and would
 * strand any destination whose current text matches no record here.
 *
 * Slugs are bare, like destinations: the project decides whether these live at
 * `/regions/everest` or somewhere else entirely.
 */
export const regions = {
  async list(options?: RegionListOptions): Promise<Paginated<Region>> {
    const store = await collection();
    const query = buildListQuery(options, SEARCH_FIELDS);

    const where: FilterCondition[] = [...(query.where ?? [])];
    if (options?.featured !== undefined) {
      where.push({ field: "featured", op: "eq", value: options.featured });
    }

    return store.list({
      ...query,
      where: where.length ? where : undefined,
      sort: [
        {
          field: options?.sort || "updatedAt",
          direction: options?.order ?? "desc",
        },
      ],
    });
  },

  async get(id: string): Promise<Region | null> {
    return (await collection()).findById(id);
  },

  /** Frontend lookup. Drafts and not-yet-due scheduled records return null. */
  async getBySlug(slug: string): Promise<Region | null> {
    const found = await this.getBySlugIncludingDrafts(slug);
    return found && isPubliclyVisible(found) ? found : null;
  },

  /** Preview/admin lookup: ignores publication state. */
  async getBySlugIncludingDrafts(slug: string): Promise<Region | null> {
    const store = await collection();
    return store.findOne({
      where: [{ field: "slug", op: "eq", value: slugify(slug) }],
    });
  },

  /** Published regions in display order — the listing page. */
  async getPublished(options?: RegionListOptions): Promise<Region[]> {
    const store = await collection();

    const where: FilterCondition[] = [PUBLIC_STATUS_FILTER];
    if (options?.featured !== undefined) {
      where.push({ field: "featured", op: "eq", value: options.featured });
    }

    const candidates = await store.findMany({
      where,
      sort: [
        { field: options?.sort ?? "order", direction: options?.order ?? "asc" },
      ],
    });

    const visible = candidates.filter((record) => isPubliclyVisible(record));
    return options?.perPage ? visible.slice(0, options.perPage) : visible;
  },

  /** The homepage set: featured, published, in order. */
  async getFeatured(limit = 6): Promise<Region[]> {
    return this.getPublished({ featured: true, perPage: limit });
  },

  async count(options?: RegionListOptions): Promise<number> {
    const store = await collection();
    return store.count(buildListQuery(options, SEARCH_FIELDS));
  },

  /** Minimal projection, for any picker that later references a region. */
  /**
   * Resolves the ids a tour stores, in the order the tour stores them.
   *
   * Stale ids are dropped rather than reported, for the same reason as
   * `activities.byIds`: nothing rewrites a tour when a record is deleted.
   */
  async byIds(ids: string[]): Promise<Region[]> {
    if (ids.length === 0) return [];

    const store = await collection();
    const found = await store.findMany({
      where: [{ field: "id", op: "in", value: ids }],
      limit: FACET_SCAN_LIMIT,
    });

    const byId = new Map(found.map((record) => [record.id, record]));
    return ids
      .map((id) => byId.get(id))
      .filter((record): record is Region => record !== undefined);
  },

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
   * Creates a region from the tour editor's inline control.
   *
   * Name and slug only, pinned to `draft`: see the note on
   * `tourCategories.quickCreate`. An existing slug is returned as-is rather
   * than raising a conflict.
   */
  async quickCreate(
    input: { name: string; slug: string },
    ctx: WriteContext,
  ): Promise<Region> {
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
      faqs: [],
      featured: false,
      order: 0,
      status: "draft",
      publishedAt: null,
      seo: EMPTY_SEO,
      updatedBy: ctx.userId,
    });
  },

  async create(input: RegionInputParsed, ctx: WriteContext): Promise<Region> {
    const store = await collection();
    await assertSlugFree(input.slug, null);

    return store.create({
      ...fields(input),
      publishedAt: resolvePublication(input.status, input.publishedAt, null),
      updatedBy: ctx.userId,
    });
  },

  async update(
    id: string,
    input: RegionInputParsed,
    ctx: WriteContext,
  ): Promise<Region> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Region");

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

    if (!updated) throw new NotFoundError("Region");
    return updated;
  },

  async setStatus(
    id: string,
    status: Region["status"],
    ctx: WriteContext,
  ): Promise<Region> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Region");

    const updated = await store.update(id, {
      status,
      publishedAt: resolvePublication(status, null, existing.publishedAt),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Region");
    return updated;
  },

  async trash(id: string, ctx: WriteContext): Promise<Region> {
    return this.setStatus(id, "trash", ctx);
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },

  async duplicate(id: string, ctx: WriteContext): Promise<Region> {
    const store = await collection();
    const source = await store.findById(id);
    if (!source) throw new NotFoundError("Region");

    return store.create({
      ...source,
      id: undefined,
      name: `${source.name} (copy)`,
      slug: await findFreeSlug(source.slug),
      faqs: source.faqs?.map((faq) => ({ ...faq, id: crypto.randomUUID() })) ?? [],
      status: "draft",
      publishedAt: null,
      featured: false,
      updatedBy: ctx.userId,
    } as Omit<Region, "id" | "createdAt" | "updatedAt"> & { id?: string });
  },
};

/** The fields the form owns, shared by create and update. */
function fields(input: RegionInputParsed) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    featuredImage: input.featuredImage,
    featuredImageHorizontal: input.featuredImageHorizontal,
    featuredImageVertical: input.featuredImageVertical,
    bannerImage: input.bannerImage,
    gallery: input.gallery,
    faqs: input.faqs,
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
