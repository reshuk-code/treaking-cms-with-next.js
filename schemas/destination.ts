import { z } from "zod";

import {
  bareSlugSchema,
  contentStatusSchema,
  optionalUrl,
} from "./common";
import { richContentSchema } from "./rich-text";
import { embeddedFaqSchema } from "./faq";
import { seoSchema } from "./seo";

/** Months, in calendar order — the vocabulary for "best season". */
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const monthSchema = z.enum(MONTHS);

/** Input accepted when creating or updating a destination. */
export const destinationInputSchema = z.object({
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

export const destinationInputWithRulesSchema =
  destinationInputSchema.superRefine((value, ctx) => {
    if (value.status === "scheduled" && !value.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Pick a publication date to schedule this destination.",
      });
    }
  });

export type DestinationInput = z.input<typeof destinationInputSchema>;
export type DestinationInputParsed = z.output<typeof destinationInputSchema>;

/** Query-string parameters for the destinations list, beyond the shared ones. */
export const destinationFiltersSchema = z.object({
  featured: z.enum(["", "yes", "no"]).default(""),
});
