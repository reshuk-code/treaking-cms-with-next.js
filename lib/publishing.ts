import type { ContentStatus } from "@/types/common";

/**
 * What the Status field starts on for a record that does not exist yet.
 *
 * Published, so that writing something and pressing Save puts it on the site —
 * the behaviour an operator expects, and the one they asked for.
 *
 * It falls back to `draft` for a role without the publish permission, and that
 * fallback is not a nicety. Rule 7 keeps `*.publish` separate from `*.update`,
 * and the server action enforces it: an Author who submitted a form defaulted
 * to "published" would get a permission error on a record they are perfectly
 * entitled to save. The control has to open on something they can actually do.
 *
 * Shared by every content editor so the answer is in one place rather than
 * eight, and deliberately free of `server-only` — the forms are client
 * components.
 */
export function defaultNewStatus(canPublish: boolean): ContentStatus {
  return canPublish ? "published" : "draft";
}
