import { z } from "zod";

import { optionalText } from "./common";
import { passwordSchema } from "./user";

/**
 * Traveller accounts: the public half of authentication.
 *
 * A traveller is a customer of the client's travel company, stored in the same
 * `users` collection as staff and separated by role. None of these schemas
 * accepts a `role`, an `active` flag or an `extraPermissions` list — the
 * repository fixes all three. Registration is unauthenticated, so anything
 * these schemas let through is something a stranger chose.
 */
export const travellerRegistrationSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(120),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    phone: optionalText,
    country: optionalText,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords do not match.",
  });

/**
 * What a traveller may change about themselves.
 *
 * Email is absent deliberately: with no mailer in this template there is no
 * way to confirm a new address, and an unconfirmed email change is an account
 * takeover waiting to be reported.
 */
export const travellerProfileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  phone: optionalText,
  country: optionalText,
});

export type TravellerRegistrationInput = z.input<
  typeof travellerRegistrationSchema
>;
export type TravellerProfileInput = z.input<typeof travellerProfileSchema>;
