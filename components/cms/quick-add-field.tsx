"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions/result";
import { slugify } from "@/schemas/common";

export interface QuickAddOption {
  id: string;
  name: string;
}

/**
 * "New X" inside the tour editor's Placement panel.
 *
 * Three things about this component are deliberate and easy to undo by
 * accident:
 *
 * 1. It is not a `<form>`. It renders inside the tour editor's form, and HTML
 *    forbids nesting one form in another — the browser drops the inner tags
 *    and the Add button starts submitting the *tour*.
 * 2. For the same reason, Enter in either input is intercepted. Without that,
 *    Enter reaches the outer form and saves a half-finished trip.
 * 3. The created record is handed back through `onCreated` rather than pulled
 *    in by revalidating the route. Revalidating here re-renders the editor and
 *    discards every unsaved field in it — the bug this panel exists to avoid.
 */
export function QuickAddField({
  label,
  placeholder,
  action,
  onCreated,
}: {
  /** Singular, lowercase: "category" gives "New category". */
  label: string;
  placeholder: string;
  action: (name: string, slug: string) => Promise<ActionState>;
  onCreated: (option: QuickAddOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // null means "follow the name"; a string means someone typed their own.
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const slug = slugOverride ?? (name ? slugify(name) : "");

  function close() {
    setOpen(false);
    setName("");
    setSlugOverride(null);
    setError(null);
  }

  function submit() {
    if (!name.trim() || pending) return;

    startTransition(async () => {
      const result = await action(name.trim(), slug);

      if (!result.ok || !result.data?.id) {
        const message =
          result.fieldErrors?.name?.[0] ??
          result.fieldErrors?.slug?.[0] ??
          result.message ??
          "That did not work.";
        setError(message);
        return;
      }

      onCreated({ id: result.data.id, name: result.data.name ?? name.trim() });
      toast.success(result.message ?? `"${name.trim()}" added.`);
      close();
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Never let Enter bubble out to the editor's own form.
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4"
      >
        <Plus className="size-3.5" />
        New {label}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          New {label}
        </span>
        <button
          type="button"
          onClick={close}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          <span className="sr-only">Cancel</span>
        </button>
      </div>

      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={`New ${label} name`}
        autoFocus
      />

      <Input
        value={slug}
        onChange={(event) => setSlugOverride(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="slug"
        aria-label={`New ${label} slug`}
        className="font-mono text-xs"
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={close}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={pending || !name.trim()}
        >
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Saved as a draft and ticked below. Add the description, images and
        publish it later in its own editor.
      </p>
    </div>
  );
}
