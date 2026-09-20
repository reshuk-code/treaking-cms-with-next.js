"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Copy,
  MoreHorizontal,
  PencilLine,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteTourCategoryAction,
  duplicateTourCategoryAction,
  setTourCategoryStatusAction,
} from "@/app/admin/(dashboard)/trip-categories/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { ContentStatus } from "@/types/common";

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted";

/**
 * Row actions for a trip category. No View entry, for the same reason as
 * activities: nothing mounts a public route for these yet.
 */
export function TourCategoryRowActions({
  category,
  canUpdate,
  canDelete,
  canPublish,
  canCreate,
}: {
  category: {
    id: string;
    name: string;
    status: ContentStatus;
    usedByTours: number;
  };
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message ?? "Done.");
      else toast.error(result.message ?? "That did not work.");
      router.refresh();
    });
  }

  function setStatus(status: ContentStatus) {
    run(() => setTourCategoryStatusAction(category.id, status));
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canUpdate ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/trip-categories/${category.id}`}>
            <PencilLine className="size-4" />
            <span className="sr-only">Edit {category.name}</span>
          </Link>
        </Button>
      ) : null}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">More actions for {category.name}</span>
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-48 rounded-md border border-border bg-card p-1 shadow-lg"
          >
            {canPublish && category.status !== "published" ? (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => setStatus("published")}
              >
                <Send className="size-4" />
                Publish
              </DropdownMenu.Item>
            ) : null}

            {canPublish && category.status === "published" ? (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => setStatus("draft")}
              >
                <Undo2 className="size-4" />
                Switch to draft
              </DropdownMenu.Item>
            ) : null}

            {canDelete && category.status === "trash" ? (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => setStatus("draft")}
              >
                <Undo2 className="size-4" />
                Restore from trash
              </DropdownMenu.Item>
            ) : null}

            {canCreate ? (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() =>
                  run(() => duplicateTourCategoryAction(category.id))
                }
              >
                <Copy className="size-4" />
                Duplicate
              </DropdownMenu.Item>
            ) : null}

            {canDelete && category.status !== "trash" ? (
              <DropdownMenu.Item
                className={`${itemClass} text-destructive`}
                onSelect={() => setStatus("trash")}
              >
                <Trash2 className="size-4" />
                Move to trash
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {canDelete && category.status === "trash" ? (
        <ConfirmButton
          variant="ghost"
          size="sm"
          title={`Delete "${category.name}"?`}
          description={
            category.usedByTours > 0
              ? `${category.usedByTours} trip${
                  category.usedByTours === 1 ? " is" : "s are"
                } sold under this category. Deleting it leaves those tags pointing at nothing — they will simply stop appearing. This cannot be undone.`
              : "This removes the category permanently. No trips currently use it. This cannot be undone."
          }
          confirmLabel="Delete permanently"
          successMessage="Trip category deleted."
          action={async () => {
            const result = await deleteTourCategoryAction(category.id);
            router.refresh();
            return result.ok ? undefined : { error: result.message };
          }}
        >
          <Trash2 className="size-4 text-destructive" />
          <span className="sr-only">Delete {category.name} permanently</span>
        </ConfirmButton>
      ) : null}
    </div>
  );
}
