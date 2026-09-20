import { Plus, Tags } from "lucide-react";
import Link from "next/link";

import { TourCategoryRowActions } from "@/app/admin/(dashboard)/trip-categories/row-actions";
import { ListToolbar } from "@/components/cms/list-toolbar";
import { MediaThumb } from "@/components/cms/media-thumb";
import { PageHeader } from "@/components/cms/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  EmptyState,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { tourCategories } from "@/lib/cms/repositories/tour-categories";
import { tours } from "@/lib/cms/repositories/tours";
import { listOptionsSchema } from "@/schemas/common";

export const metadata = { title: "Trip categories" };

export default async function TripCategoriesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("tourCategories.read");
  const params = await searchParams;

  const options = listOptionsSchema.parse({
    page: params.page,
    perPage: params.perPage,
    search: params.search,
    status: params.status,
    sort: params.sort,
    order: params.order,
  });

  const [result, usage] = await Promise.all([
    tourCategories.list(options),
    tours.categoryUsage(),
  ]);

  const canCreate = hasPermission(
    { role: session.role },
    "tourCategories.create",
  );
  const canUpdate = hasPermission(
    { role: session.role },
    "tourCategories.update",
  );
  const canDelete = hasPermission(
    { role: session.role },
    "tourCategories.delete",
  );
  const canPublish = hasPermission(
    { role: session.role },
    "tourCategories.publish",
  );

  const filtered = Boolean(options.search) || options.status !== "any";

  return (
    <>
      <PageHeader
        title="Trip categories"
        description="How trips are sold — Luxury, VIP, Budget. Trip packages tag themselves with these."
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/admin/trip-categories/new">
                <Plus className="size-4" />
                New category
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <ListToolbar placeholder="Search categories by name or slug…" />

        {result.items.length === 0 ? (
          <EmptyState
            icon={<Tags className="size-8" />}
            title={
              filtered
                ? "No categories match those filters"
                : "No trip categories yet"
            }
            description={
              filtered
                ? "Try a different search term, or clear the status filter."
                : "Add the tiers you sell under — Luxury, VIP, Budget. You can also add one without leaving the trip editor."
            }
            action={
              canCreate && !filtered ? (
                <Button asChild size="sm">
                  <Link href="/admin/trip-categories/new">
                    Add your first category
                  </Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH className="hidden sm:table-cell">Used by</TH>
                <TH className="hidden md:table-cell">Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>

            <TBody>
              {result.items.map((item) => {
                const usedByTours = usage[item.id] ?? 0;

                return (
                  <TR key={item.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="size-9 shrink-0 overflow-hidden rounded-md border border-border">
                          <MediaThumb
                            url={item.featuredImage ?? ""}
                            kind={item.featuredImage ? "image" : "other"}
                            alt=""
                          />
                        </div>

                        <div className="min-w-0">
                          {canUpdate ? (
                            <Link
                              href={`/admin/trip-categories/${item.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {item.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{item.name}</span>
                          )}
                          <span className="block truncate text-xs text-muted-foreground">
                            <code>{item.slug}</code>
                          </span>
                        </div>
                      </div>
                    </TD>

                    <TD className="hidden text-xs text-muted-foreground sm:table-cell">
                      {usedByTours === 0
                        ? "No trips"
                        : `${usedByTours} trip${usedByTours === 1 ? "" : "s"}`}
                    </TD>

                    <TD className="hidden md:table-cell">
                      <StatusBadge status={item.status} />
                    </TD>

                    <TD className="text-right">
                      <TourCategoryRowActions
                        category={{
                          id: item.id,
                          name: item.name,
                          status: item.status,
                          usedByTours,
                        }}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        canPublish={canPublish}
                        canCreate={canCreate}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}

        <Pagination
          result={result}
          basePath="/admin/trip-categories"
          searchParams={{
            search: options.search || undefined,
            status: options.status === "any" ? undefined : options.status,
          }}
        />
      </Card>
    </>
  );
}
