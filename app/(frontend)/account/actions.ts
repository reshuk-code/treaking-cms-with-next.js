"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  actionError,
  actionSuccess,
  formString,
  toActionState,
  type ActionState,
} from "@/lib/actions/result";
import { getAuthAdapter, signIn, signOut } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth/password";
import {
  getTravellerSession,
  requireTraveller,
  travellerAuthAvailable,
} from "@/lib/auth/traveller";
import { users } from "@/lib/cms/repositories/users";
import { changePasswordSchema, credentialsSchema } from "@/schemas/user";
import {
  travellerProfileSchema,
  travellerRegistrationSchema,
} from "@/schemas/traveller";
import { isStaffRole } from "@/types/user";

/**
 * Public account actions.
 *
 * These are the only server actions in this codebase reachable by someone who
 * is not signed in, which is why registration and sign-in are so careful about
 * what they accept: the schemas take no role and no active flag, and the
 * repository fixes both.
 *
 * Nothing here calls `requirePermission()`, because a traveller holds no
 * permissions at all. `requireTraveller()` is the equivalent boundary — it
 * establishes *whose* record is being edited, and every write below goes to
 * that id and never to one read from the form.
 */

/** Sends a traveller back where they came from, never off-site. */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/account";
  // A protocol-relative "//evil.example" is a same-string-different-origin
  // trick, so one leading slash is required and two are refused.
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  if (value.startsWith("/admin")) return "/account";
  return value;
}

export async function registerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let next = "/account";

  try {
    if (!(await travellerAuthAvailable())) {
      return actionError(
        "This site signs visitors in through its identity provider. " +
          "Registration here is unavailable.",
      );
    }

    const parsed = travellerRegistrationSchema.safeParse({
      name: formString(formData.get("name")),
      email: formString(formData.get("email")),
      phone: formString(formData.get("phone")),
      country: formString(formData.get("country")),
      password: formString(formData.get("password")),
      confirmPassword: formString(formData.get("confirmPassword")),
    });

    if (!parsed.success) return toActionState(parsed.error);

    /*
     * `register()` refuses a duplicate email with a ConflictError, and that
     * message reaches the form. It does tell a stranger whether an address is
     * registered — unavoidable for a sign-up form, which has to say why it
     * refused — and is the reason the *sign-in* form stays generic instead.
     */
    const traveller = await users.register(parsed.data);

    await (await getAuthAdapter()).createSession(traveller);
    next = safeNext(formData.get("next"));
  } catch (error) {
    return toActionState(error);
  }

  // `redirect` throws, so it sits outside the try/catch.
  redirect(next);
}

export async function travellerSignInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let next = "/account";

  try {
    const parsed = credentialsSchema.safeParse({
      email: formString(formData.get("email")),
      password: formString(formData.get("password")),
    });

    if (!parsed.success) {
      return actionError("Enter your email address and password.");
    }

    const session = await signIn(parsed.data);
    if (!session) {
      return actionError("Those details do not match an active account.");
    }

    /*
     * Staff credentials are valid but belong at /admin/login. Accepting them
     * here would mint an admin session from a public form — the same power,
     * but issued by a page whose threat model is "anyone on the internet".
     * The session is destroyed and the message stays generic, for the same
     * enumeration reason the admin form gives.
     */
    if (isStaffRole(session.role)) {
      await signOut();
      return actionError("Those details do not match an active account.");
    }

    next = safeNext(formData.get("next"));
  } catch (error) {
    return toActionState(error);
  }

  redirect(next);
}

export async function travellerSignOutAction(): Promise<void> {
  // Only a traveller's session is ended here. An editor who is browsing the
  // public site must not be signed out of the admin by a stray form post.
  if (await getTravellerSession()) await signOut();
  redirect("/");
}

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const traveller = await requireTraveller();

    const parsed = travellerProfileSchema.safeParse({
      name: formString(formData.get("name")),
      phone: formString(formData.get("phone")),
      country: formString(formData.get("country")),
    });

    if (!parsed.success) return toActionState(parsed.error);

    await users.updateProfile(traveller.id, parsed.data);
    revalidatePath("/account");
    return actionSuccess("Your details have been saved.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function changeTravellerPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const traveller = await requireTraveller();

    const parsed = changePasswordSchema.safeParse({
      currentPassword: formString(formData.get("currentPassword")),
      newPassword: formString(formData.get("newPassword")),
      confirmPassword: formString(formData.get("confirmPassword")),
    });

    if (!parsed.success) return toActionState(parsed.error);

    const stored = await users.findByEmailWithSecret(traveller.email);
    if (
      !stored ||
      !(await verifyPassword(parsed.data.currentPassword, stored.passwordHash))
    ) {
      return actionError("Your current password is not correct.", {
        currentPassword: ["Your current password is not correct."],
      });
    }

    await users.setPassword(traveller.id, parsed.data.newPassword);
    return actionSuccess("Password changed.");
  } catch (error) {
    return toActionState(error);
  }
}
