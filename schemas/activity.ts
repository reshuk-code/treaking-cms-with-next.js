import { richContentSchema } from "./rich-text";
import { z } from "zod";

import {
  bareSlugSchema,
  contentStatusSchema,
  optionalUrl,
} from "./common";
import { seoSchema } from "./seo";
import { embeddedFaqSchema } from "./faq";

/**
 * Input accepted when creating or updating an activity.
 *
 * Deliberately smaller than a destination: an activity is a label a tour is
 * tagged with ("trekking", "rafting"), not a place with facts of its own. It
 * still carries a slug, SEO and a publication lifecycle because a travel site
 * usually gives each one a landing page.
 */
export const activityInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: bareSlugSchema,
  description: richContentSchema,
  featuredImage: optionalUrl,
  featuredImageHorizontal: optionalUrl,
  featuredImageVertical: optionalUrl,
  bannerImage: optionalUrl,
  gallery: z.array(z.string().trim()).default([]),
  faqs: z.array(embeddedFaqSchema).max(50).default([]),
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

export const activityInputWithRulesSchema = activityInputSchema.superRefine(
  (value, ctx) => {
    if (value.status === "scheduled" && !value.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Pick a publication date to schedule this activity.",
      });
    }
  },
);

export type ActivityInput = z.input<typeof activityInputSchema>;
export type ActivityInputParsed = z.output<typeof activityInputSchema>;

/**
 * What the tour editor's inline create accepts: a name and a slug.
 *
 * Everything else is left at its default and filled in later in the real
 * editor. The status is not accepted here at all — the repository pins a
 * quick-created record to `draft`, so this control can never publish.
 */
export const quickActivitySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: bareSlugSchema,
});

export type QuickActivityInput = z.output<typeof quickActivitySchema>;
