import { z } from "zod";

import {
  bareSlugSchema,
  contentStatusSchema,
  optionalUrl,
} from "./common";
import { richContentSchema } from "./rich-text";
import { seoSchema } from "./seo";

/**
 * Input accepted when creating or updating a trip category.
 *
 * The same shape as an activity, one field lighter: a category has no FAQs,
 * because a question about what "Luxury" includes belongs on the trip that
 * makes the promise, not on the label.
 *
 * `quickTourCategorySchema` below is the subset the tour editor's inline
 * "New category" control posts.
 */
export const tourCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: bareSlugSchema,
  description: richContentSchema,
  featuredImage: optionalUrl,
  featuredImageHorizontal: optionalUrl,
  featuredImageVertical: optionalUrl,
  bannerImage: optionalUrl,
  gallery: z.array(z.string().trim()).default([]),
  featured: z.coerce.boolean().default(false),
  order: z.coerce.number().int().default(0),
  status: contentStatusSchema.default("draft"),
  publishedAt: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || !Number.isNaN(Date.parse(value)),
      "Publication date is not a valid date.",
    ),
  seo: seoSchema.prefault({}),
});

export const tourCategoryInputWithRulesSchema =
  tourCategoryInputSchema.superRefine((value, ctx) => {
    if (value.status === "scheduled" && !value.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Pick a publication date to schedule this category.",
      });
    }
  });

/**
 * What the tour editor's inline create accepts: a name and a slug.
 *
 * Everything else is left at its default and filled in later in the real
 * editor. The status is not accepted from the form at all — the repository
 * pins a quick-created record to `draft`, so this control can never publish.
 */
export const quickTourCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: bareSlugSchema,
});

export type TourCategoryInput = z.input<typeof tourCategoryInputSchema>;
export type TourCategoryInputParsed = z.output<typeof tourCategoryInputSchema>;
export type QuickTourCategoryInput = z.output<typeof quickTourCategorySchema>;
