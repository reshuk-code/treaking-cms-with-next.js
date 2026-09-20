"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionSuccess,
  formBoolean,
  formString,
  toActionState,
  type ActionState,
} from "@/lib/actions/result";
import { requirePermission } from "@/lib/auth";
import { activity } from "@/lib/cms/repositories/activity";
import { tourCategories } from "@/lib/cms/repositories/tour-categories";
import {
  quickTourCategorySchema,
  tourCategoryInputWithRulesSchema,
} from "@/schemas/tour-category";
import type { ContentStatus } from "@/types/common";

/** Trip category server actions. `activity` here is the audit log. */

function parseFormData(formData: FormData) {
  return {
    name: formString(formData.get("name")),
    slug: formString(formData.get("slug")) || formString(formData.get("name")),
    description: formString(formData.get("description")),
    featuredImage: formString(formData.get("featuredImage")),
    featuredImageHorizontal: formString(formData.get("featuredImageHorizontal")),
    featuredImageVertical: formString(formData.get("featuredImageVertical")),
    bannerImage: formString(formData.get("bannerImage")),
    gallery: formData.getAll("gallery").map(String),
    featured: formBoolean(formData.get("featured")),
    order: formString(formData.get("order")) || "0",
    status: formString(formData.get("status")),
    publishedAt: formString(formData.get("publishedAt")) || null,
    seo: {
      title: formString(formData.get("seo.title")),
      description: formString(formData.get("seo.description")),
      canonical: formString(formData.get("seo.canonical")),
      robots: formString(formData.get("seo.robots")) || "index",
      noFollow: formBoolean(formData.get("seo.noFollow")),
      ogTitle: formString(formData.get("seo.ogTitle")),
      ogDescription: formString(formData.get("seo.ogDescription")),
      ogImage: formString(formData.get("seo.ogImage")),
      twitterCard:
        formString(formData.get("seo.twitterCard")) || "summary_large_image",
      structuredData: formString(formData.get("seo.structuredData")),
    },
  };
}

export async function saveTourCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formString(formData.get("id"));
  const isNew = !id;

  let createdId: string | null = null;

  try {
    const session = await requirePermission(
      isNew ? "tourCategories.create" : "tourCategories.update",
    );

    const parsed = tourCategoryInputWithRulesSchema.safeParse(
      parseFormData(formData),
    );
    if (!parsed.success) return toActionState(parsed.error);

    if (parsed.data.status === "published" || parsed.data.status === "scheduled") {
      await requirePermission("tourCategories.publish");
    }

    const record = isNew
      ? await tourCategories.create(parsed.data, { userId: session.userId })
      : await tourCategories.update(id, parsed.data, { userId: session.userId });

    await activity.record({
      action: isNew ? "created" : "updated",
      entityType: "tour_categories",
      entityId: record.id,
      entityTitle: record.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/trip-categories");
    revalidatePath("/", "layout");

    if (isNew) createdId = record.id;
  } catch (error) {
    return toActionState(error);
  }

  if (createdId) redirect(`/admin/trip-categories/${createdId}`);

  return actionSuccess("Trip category saved.");
}

/**
 * Creates a category from the tour editor, without leaving it.
 *
 * Returns the record rather than revalidating the tour route: a revalidation
 * here would re-render the editor around a half-filled trip and throw away
 * everything typed so far. The caller adds the returned option to its own
 * state instead.
 */
export async function quickCreateTourCategoryAction(
  name: string,
  slug: string,
): Promise<ActionState> {
  try {
    const session = await requirePermission("tourCategories.create");

    const parsed = quickTourCategorySchema.safeParse({
      name,
      slug: slug || name,
    });
    if (!parsed.success) return toActionState(parsed.error);

    const record = await tourCategories.quickCreate(parsed.data, {
      userId: session.userId,
    });

    await activity.record({
      action: "created",
      entityType: "tour_categories",
      entityId: record.id,
      entityTitle: record.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/trip-categories");

    return actionSuccess(`"${record.name}" added.`, {
      id: record.id,
      name: record.name,
    });
  } catch (error) {
    return toActionState(error);
  }
}

export async function setTourCategoryStatusAction(
  id: string,
  status: ContentStatus,
): Promise<ActionState> {
  try {
    const session = await requirePermission(
      status === "trash" ? "tourCategories.delete" : "tourCategories.publish",
    );

    const record = await tourCategories.setStatus(id, status, {
      userId: session.userId,
    });

    await activity.record({
      action:
        status === "published"
          ? "published"
          : status === "trash"
            ? "trashed"
            : "unpublished",
      entityType: "tour_categories",
      entityId: record.id,
      entityTitle: record.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/trip-categories");
    revalidatePath("/", "layout");
    return actionSuccess("Trip category updated.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteTourCategoryAction(
  id: string,
): Promise<ActionState> {
  try {
    const session = await requirePermission("tourCategories.delete");

    const record = await tourCategories.get(id);
    if (!record) return actionError("That trip category no longer exists.");

    await tourCategories.delete(id);

    await activity.record({
      action: "deleted",
      entityType: "tour_categories",
      entityId: id,
      entityTitle: record.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/trip-categories");
    revalidatePath("/admin/tours", "layout");
    revalidatePath("/", "layout");
    return actionSuccess("Trip category deleted.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function duplicateTourCategoryAction(
  id: string,
): Promise<ActionState> {
  try {
    const session = await requirePermission("tourCategories.create");
    const copy = await tourCategories.duplicate(id, { userId: session.userId });

    await activity.record({
      action: "duplicated",
      entityType: "tour_categories",
      entityId: copy.id,
      entityTitle: copy.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/trip-categories");
    return actionSuccess("Trip category duplicated.", { id: copy.id });
  } catch (error) {
    return toActionState(error);
  }
}
