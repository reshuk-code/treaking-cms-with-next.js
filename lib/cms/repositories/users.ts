import "server-only";

import { ConflictError, NotFoundError } from "@/lib/cms/errors";
import { getDatabase } from "@/lib/database";
import { hashPassword } from "@/lib/auth/password";
import type { ListOptions, Paginated } from "@/types/common";
import type { CmsUser, Role, StoredUser } from "@/types/user";

import { buildListQuery } from "./base";

const SEARCH_FIELDS = ["name", "email"];

/**
 * Travellers live in this collection too, so every staff-facing read excludes
 * them explicitly. Left implicit, the admin's user list would fill up with the
 * client's customers and `isFirstRun()` would stop offering the setup screen
 * the moment a member of the public registered.
 */
const NOT_A_TRAVELLER = {
  field: "role",
  op: "ne",
  value: "traveller",
} as const;

async function collection() {
  return (await getDatabase()).collection<StoredUser>("users");
}

/** Strips credential material before a user record leaves the auth layer. */
export function toPublicUser(user: StoredUser): CmsUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/**
 * Users repository.
 *
 * `passwordHash` never escapes this module except through
 * `findByEmailWithSecret`, which exists solely for the credentials auth
 * adapter. Every other method returns a `CmsUser`.
 */
export const users = {
  async list(options?: ListOptions): Promise<Paginated<CmsUser>> {
    const store = await collection();
    const page = await store.list({
      ...buildListQuery(options, SEARCH_FIELDS),
      // Users have no editorial status; buildListQuery would filter on it.
      where: [NOT_A_TRAVELLER],
    });

    return { ...page, items: page.items.map(toPublicUser) };
  },

  /** Registered travellers, newest first. Never mixed into `list()`. */
  async listTravellers(options?: ListOptions): Promise<Paginated<CmsUser>> {
    const store = await collection();
    const page = await store.list({
      ...buildListQuery(options, SEARCH_FIELDS),
      where: [{ field: "role", op: "eq", value: "traveller" }],
    });

    return { ...page, items: page.items.map(toPublicUser) };
  },

  async get(id: string): Promise<CmsUser | null> {
    const user = await (await collection()).findById(id);
    return user ? toPublicUser(user) : null;
  },

  async findByEmail(email: string): Promise<CmsUser | null> {
    const user = await this.findByEmailWithSecret(email);
    return user ? toPublicUser(user) : null;
  },

  /** Auth-only. Callers must not return the result to a client. */
  async findByEmailWithSecret(email: string): Promise<StoredUser | null> {
    const store = await collection();
    return store.findOne({
      where: [
        { field: "email", op: "eq", value: email.trim().toLowerCase() },
      ],
    });
  },

  /** Staff only. A traveller is not a user of the CMS. */
  async count(): Promise<number> {
    return (await collection()).count({ where: [NOT_A_TRAVELLER] });
  },

  /**
   * True before the first *staff* user exists, which triggers the setup
   * screen. Counting travellers here would let a stranger who registered on
   * the public site close the door on an install that was never set up.
   */
  async isFirstRun(): Promise<boolean> {
    return (await this.count()) === 0;
  },

  async create(input: {
    email: string;
    name: string;
    password: string;
    role: Role;
    active?: boolean;
    avatar?: string | null;
    phone?: string | null;
    country?: string | null;
  }): Promise<CmsUser> {
    const store = await collection();
    const email = input.email.trim().toLowerCase();

    if (await this.findByEmailWithSecret(email)) {
      throw new ConflictError(
        "An account with that email address already exists.",
        "email",
      );
    }

    const created = await store.create({
      email,
      name: input.name.trim(),
      role: input.role,
      avatar: input.avatar ?? null,
      active: input.active ?? true,
      lastLoginAt: null,
      extraPermissions: [],
      phone: input.phone ?? null,
      country: input.country ?? null,
      passwordHash: await hashPassword(input.password),
    });

    return toPublicUser(created);
  },

  async update(
    id: string,
    patch: {
      email?: string;
      name?: string;
      role?: Role;
      active?: boolean;
      avatar?: string | null;
    },
  ): Promise<CmsUser> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("User");

    /*
     * Staff and travellers share this collection, so a role patch is the one
     * edit that could turn a member of the public into an editor. Crossing the
     * line is refused here rather than in the users screen, because the screen
     * is not the boundary and a second caller would not repeat the check.
     */
    if (patch.role && (patch.role === "traveller") !== (existing.role === "traveller")) {
      throw new ConflictError(
        "A traveller account cannot be turned into a staff account, or the reverse.",
        "role",
      );
    }

    if (patch.email) {
      const email = patch.email.trim().toLowerCase();
      const clash = await this.findByEmailWithSecret(email);
      if (clash && clash.id !== id) {
        throw new ConflictError(
          "An account with that email address already exists.",
          "email",
        );
      }
      patch = { ...patch, email };
    }

    const updated = await store.update(id, patch);
    if (!updated) throw new NotFoundError("User");
    return toPublicUser(updated);
  },

  async setPassword(id: string, password: string): Promise<void> {
    const store = await collection();
    const updated = await store.update(id, {
      passwordHash: await hashPassword(password),
    });
    if (!updated) throw new NotFoundError("User");
  },

  async recordLogin(id: string): Promise<void> {
    const store = await collection();
    await store.update(id, { lastLoginAt: new Date().toISOString() });
  },

  /**
   * Deleting the last super admin would lock everyone out, so it is refused.
   * The same guard applies to demoting oneself in the users server actions.
   */
  async delete(id: string): Promise<boolean> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) return false;

    if (existing.role === "super_admin") {
      const superAdmins = await store.count({
        where: [{ field: "role", op: "eq", value: "super_admin" }],
      });
      if (superAdmins <= 1) {
        throw new ConflictError(
          "This is the only super admin. Promote another user first.",
        );
      }
    }

    return store.delete(id);
  },

  /**
   * Registers a traveller from the public site.
   *
   * The role is fixed here and never read from the caller: registration is an
   * unauthenticated endpoint, so a `role` that could be influenced from
   * outside is the one mistake that turns this feature into a way in.
   */
  async register(input: {
    email: string;
    name: string;
    password: string;
    phone?: string | null;
    country?: string | null;
  }): Promise<CmsUser> {
    return this.create({
      email: input.email,
      name: input.name,
      password: input.password,
      phone: input.phone ?? null,
      country: input.country ?? null,
      role: "traveller",
    });
  },

  /** A traveller by id, or null for any other role. Ownership reads use this. */
  async getTraveller(id: string): Promise<CmsUser | null> {
    const user = await (await collection()).findById(id);
    if (!user || user.role !== "traveller") return null;
    return toPublicUser(user);
  },

  /**
   * The fields a traveller may change about themselves.
   *
   * Email is not among them. Changing it is an identity change, and with no
   * mailer in this template there is nothing to confirm the new address with —
   * see docs/ROADMAP.md.
   */
  async updateProfile(
    id: string,
    patch: { name: string; phone: string | null; country: string | null },
  ): Promise<CmsUser> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing || existing.role !== "traveller") {
      throw new NotFoundError("Traveller");
    }

    const updated = await store.update(id, {
      name: patch.name.trim(),
      phone: patch.phone,
      country: patch.country,
    });
    if (!updated) throw new NotFoundError("Traveller");
    return toPublicUser(updated);
  },

  async countByRole(role: Role): Promise<number> {
    const store = await collection();
    return store.count({ where: [{ field: "role", op: "eq", value: role }] });
  },
};
