import { notFound } from "next/navigation";

import { PageHeader } from "@/components/cms/page-header";
import { TourForm } from "@/components/cms/tour-form";
import { StatusBadge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { activities } from "@/lib/cms/repositories/activities";
import { destinations } from "@/lib/cms/repositories/destinations";
import { regions } from "@/lib/cms/repositories/regions";
import { settings } from "@/lib/cms/repositories/settings";
import { tourCategories } from "@/lib/cms/repositories/tour-categories";
import { tours } from "@/lib/cms/repositories/tours";
import { describeRecord } from "@/lib/record-meta";

export const metadata = { title: "Edit tour" };

export default async function EditTourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("tours.update");
  const { id } = await params;

  const [
    tour,
    destinationOptions,
    regionOptions,
    activityOptions,
    categoryOptions,
    siteUrl,
  ] = await Promise.all([
    tours.get(id),
    destinations.options(),
    regions.options(),
    activities.options(),
    tourCategories.options(),
    settings.siteUrl(),
  ]);

  if (!tour) notFound();

  return (
    <>
      <PageHeader
        title={tour.name}
        description={describeRecord(tour)}
        breadcrumbs={[
          { label: "Tour packages", href: "/admin/tours" },
          { label: tour.name },
        ]}
        actions={<StatusBadge status={tour.status} />}
      />

      <TourForm
        tour={tour}
        destinationOptions={destinationOptions.map(({ id: optionId, name }) => ({
          id: optionId,
          name,
        }))}
        regionOptions={regionOptions.map(({ id: optionId, name }) => ({
          id: optionId,
          name,
        }))}
        activityOptions={activityOptions.map(({ id: optionId, name }) => ({
          id: optionId,
          name,
        }))}
        categoryOptions={categoryOptions.map(({ id: optionId, name }) => ({
          id: optionId,
          name,
        }))}
        canQuickAdd={{
          categories: hasPermission(
            { role: session.role },
            "tourCategories.create",
          ),
          regions: hasPermission({ role: session.role }, "regions.create"),
          activities: hasPermission({ role: session.role }, "activities.create"),
        }}
        siteUrl={siteUrl}
        canPublish={hasPermission({ role: session.role }, "tours.publish")}
      />
    </>
  );
}
