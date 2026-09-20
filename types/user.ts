import type { BaseRecord, ID } from "./common";

/**
 * Roles that belong to the admin panel, most to least privileged.
 * A role is a named bundle of permissions (see lib/auth/permissions.ts).
 */
export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "editor",
  "author",
  "viewer",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Every role, including the one that is not staff at all.
 *
 * `traveller` is a customer of the client's travel company. It shares the
 * `users` collection with staff because one table is cheaper than two, and it
 * is safe to do so only because it holds no permissions and because every
 * admin surface offers `STAFF_ROLES` rather than this list — otherwise an
 * operator could promote a member of the public into the CMS from the users
 * screen. Derived from STAFF_ROLES so the two cannot drift apart.
 */
export const ROLES = [...STAFF_ROLES, "traveller"] as const;

export type Role = (typeof ROLES)[number];

export function isStaffRole(role: Role): role is StaffRole {
  return role !== "traveller";
}

/**
 * Permissions are `<resource>.<action>` strings so new resources can be added
 * without changing the auth core.
 */
export type PermissionAction = "read" | "create" | "update" | "delete" | "publish";

export type Permission = `${string}.${PermissionAction}` | "*";

export interface CmsUser extends BaseRecord {
  email: string;
  name: string;
  role: Role;
  avatar: string | null;
  active: boolean;
  lastLoginAt: string | null;
  /** Permissions granted on top of the role's defaults. */
  extraPermissions: Permission[];
  /**
   * Traveller contact details, so an enquiry can be prefilled from the account
   * instead of retyped. Null for staff, who have no use for them: these live
   * on the shared record because travellers share the `users` collection.
   */
  phone: string | null;
  country: string | null;
}

/** A user record as stored, including the credential material. */
export interface StoredUser extends CmsUser {
  /** scrypt hash; never leaves the server. See lib/auth/password.ts. */
  passwordHash: string | null;
}

/** The authenticated principal available to server code. */
export interface Session {
  userId: ID;
  email: string;
  name: string;
  role: Role;
  /** Unix seconds. */
  expiresAt: number;
}
