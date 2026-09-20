import { PageHeader } from "@/components/cms/page-header";
import { RegionForm } from "@/components/cms/region-form";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { settings } from "@/lib/cms/repositories/settings";

export const metadata = { title: "New region" };

export default async function NewRegionPage() {
  const session = await requirePermission("regions.create");

  const siteUrl = await settings.siteUrl();

  return (
    <>
      <PageHeader
        title="New region"
        breadcrumbs={[
          { label: "Regions", href: "/admin/regions" },
          { label: "New region" },
        ]}
      />

      <RegionForm
        region={null}
        siteUrl={siteUrl}
        canPublish={hasPermission({ role: session.role }, "regions.publish")}
      />
    </>
  );
}
