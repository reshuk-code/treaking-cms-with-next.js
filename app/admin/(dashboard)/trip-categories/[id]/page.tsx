import { notFound } from "next/navigation";

import { PageHeader } from "@/components/cms/page-header";
import { TourCategoryForm } from "@/components/cms/tour-category-form";
import { StatusBadge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { settings } from "@/lib/cms/repositories/settings";
import { tourCategories } from "@/lib/cms/repositories/tour-categories";
import { tours } from "@/lib/cms/repositories/tours";
import { describeRecord } from "@/lib/record-meta";

export const metadata = { title: "Edit trip category" };

export default async function EditTripCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("tourCategories.update");
  const { id } = await params;

  const [category, usage, siteUrl] = await Promise.all([
    tourCategories.get(id),
    tours.categoryUsage(),
    settings.siteUrl(),
  ]);

  if (!category) notFound();

  return (
    <>
      <PageHeader
        title={category.name}
        description={describeRecord(category)}
        breadcrumbs={[
          { label: "Trip categories", href: "/admin/trip-categories" },
          { label: category.name },
        ]}
        actions={<StatusBadge status={category.status} />}
      />

      <TourCategoryForm
        category={category}
        usedByTours={usage[category.id] ?? 0}
        siteUrl={siteUrl}
        canPublish={hasPermission(
          { role: session.role },
          "tourCategories.publish",
        )}
      />
    </>
  );
}
