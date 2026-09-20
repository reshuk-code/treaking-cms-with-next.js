import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { users } from "@/lib/cms/repositories/users";
import type { CmsUser, Session } from "@/types/user";

import { getAuthAdapter, getSession } from ".";

/**
 * The public site's half of authentication.
 *
 * A traveller is a customer of the client's travel company. They hold an
 * account in the same `users` collection as staff, separated by role and by
 * the fact that the role grants nothing (lib/auth/permissions.ts).
 *
 * These helpers exist so that no page on the public site ever reaches for
 * `getSession()` directly. That session may belong to an editor who is also
 * browsing the site, and an editor is not a traveller: `/account` must not
 * render somebody's profile just because a valid cookie is present.
 *
 * SCOPE. Traveller sign-in verifies a password against the CMS `users`
 * collection, so it works with the built-in `credentials` provider. Under a
 * hosted provider (Clerk) the CMS does not own the session at all, and the
 * account screens say so rather than showing a form that cannot work.
 */

/** The current traveller's session, or null if the visitor is anyone else. */
export const getTravellerSession = cache(async (): Promise<Session | null> => {
  const session = await getSession();
  if (!session || session.role !== "traveller") return null;
  return session;
});

/**
 * The signed-in traveller, re-read from the database.
 *
 * The session carries a name and an email, but not whether the account is
 * still active — deactivating a traveller has to lock them out at once rather
 * than at the end of a seven-day cookie.
 */
export const getTraveller = cache(async (): Promise<CmsUser | null> => {
  const session = await getTravellerSession();
  if (!session) return null;

  const traveller = await users.getTraveller(session.userId);
  if (!traveller || !traveller.active) return null;
  return traveller;
});

/**
 * Guard for the account area. Redirects rather than throwing, because these
 * are pages a visitor can reach by typing a URL, not actions.
 */
export async function requireTraveller(next?: string): Promise<CmsUser> {
  const traveller = await getTraveller();
  if (traveller) return traveller;

  const target = next ? `/account/login?next=${encodeURIComponent(next)}` : "/account/login";
  redirect(target);
}

/**
 * True when the active auth provider can verify a password from our own form.
 *
 * Under a hosted provider the sign-in screen and the session both belong to
 * the provider, so a traveller email/password form would post into nothing.
 */
export async function travellerAuthAvailable(): Promise<boolean> {
  const adapter = await getAuthAdapter();
  return adapter.signInMode === "credentials";
}
