import { PageHeader } from "@/components/cms/page-header";
import { TourCategoryForm } from "@/components/cms/tour-category-form";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { settings } from "@/lib/cms/repositories/settings";

export const metadata = { title: "New trip category" };

export default async function NewTripCategoryPage() {
  const session = await requirePermission("tourCategories.create");

  const siteUrl = await settings.siteUrl();

  return (
    <>
      <PageHeader
        title="New trip category"
        breadcrumbs={[
          { label: "Trip categories", href: "/admin/trip-categories" },
          { label: "New trip category" },
        ]}
      />

      <TourCategoryForm
        category={null}
        usedByTours={null}
        siteUrl={siteUrl}
        canPublish={hasPermission(
          { role: session.role },
          "tourCategories.publish",
        )}
      />
    </>
  );
}
