import { PageHeader } from "@/components/cms/page-header";
import { TourForm } from "@/components/cms/tour-form";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { activities } from "@/lib/cms/repositories/activities";
import { destinations } from "@/lib/cms/repositories/destinations";
import { regions } from "@/lib/cms/repositories/regions";
import { settings } from "@/lib/cms/repositories/settings";
import { tourCategories } from "@/lib/cms/repositories/tour-categories";

export const metadata = { title: "New tour" };

export default async function NewTourPage() {
  const session = await requirePermission("tours.create");

  const [
    destinationOptions,
    regionOptions,
    activityOptions,
    categoryOptions,
    siteUrl,
  ] = await Promise.all([
    destinations.options(),
    regions.options(),
    activities.options(),
    tourCategories.options(),
    settings.siteUrl(),
  ]);

  return (
    <>
      <PageHeader
        title="New tour"
        breadcrumbs={[
          { label: "Tour packages", href: "/admin/tours" },
          { label: "New tour" },
        ]}
      />

      <TourForm
        tour={null}
        destinationOptions={destinationOptions.map(({ id, name }) => ({
          id,
          name,
        }))}
        regionOptions={regionOptions.map(({ id, name }) => ({ id, name }))}
        activityOptions={activityOptions.map(({ id, name }) => ({ id, name }))}
        categoryOptions={categoryOptions.map(({ id, name }) => ({ id, name }))}
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
