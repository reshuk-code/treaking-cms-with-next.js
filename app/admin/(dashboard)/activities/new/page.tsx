import { ActivityForm } from "@/components/cms/activity-form";
import { PageHeader } from "@/components/cms/page-header";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { settings } from "@/lib/cms/repositories/settings";

export const metadata = { title: "New activity" };

export default async function NewActivityPage() {
  const session = await requirePermission("activities.create");

  const siteUrl = await settings.siteUrl();

  return (
    <>
      <PageHeader
        title="New activity"
        breadcrumbs={[
          { label: "Activities", href: "/admin/activities" },
          { label: "New activity" },
        ]}
      />

      <ActivityForm
        activity={null}
        usedByTours={null}
        siteUrl={siteUrl}
        canPublish={hasPermission({ role: session.role }, "activities.publish")}
      />
    </>
  );
}
