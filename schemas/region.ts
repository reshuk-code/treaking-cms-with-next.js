import { z } from "zod";

import {
  bareSlugSchema,
  contentStatusSchema,
  optionalUrl,
} from "./common";
import { richContentSchema } from "./rich-text";
import { embeddedFaqSchema } from "./faq";
import { seoSchema } from "./seo";

/**
 * Input accepted when creating or updating a region.
 *
 * Deliberately thinner than a destination: no coordinates, because a region is
 * an area rather than a point, and a map pin at its notional centre would be
 * wrong more often than useful.
 */
export const regionInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: bareSlugSchema,
  description: richContentSchema,
  featuredImage: optionalUrl,
  featuredImageHorizontal: optionalUrl,
  featuredImageVertical: optionalUrl,
  bannerImage: optionalUrl,
  gallery: z.array(z.string().trim()).default([]),
  faqs: z.array(embeddedFaqSchema).max(50).default([]),
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

export const regionInputWithRulesSchema = regionInputSchema.superRefine(
  (value, ctx) => {
    if (value.status === "scheduled" && !value.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Pick a publication date to schedule this region.",
      });
    }
  },
);

export type RegionInput = z.input<typeof regionInputSchema>;
export type RegionInputParsed = z.output<typeof regionInputSchema>;

/** Query-string parameters for the regions list, beyond the shared ones. */
export const regionFiltersSchema = z.object({
  featured: z.enum(["", "yes", "no"]).default(""),
});

/**
 * What the tour editor's inline create accepts: a name and a slug.
 *
 * Everything else is left at its default and filled in later in the real
 * editor. The status is not accepted here at all — the repository pins a
 * quick-created record to `draft`, so this control can never publish.
 */
export const quickRegionSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: bareSlugSchema,
});

export type QuickRegionInput = z.output<typeof quickRegionSchema>;
