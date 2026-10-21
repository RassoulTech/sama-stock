import type { Metadata } from "next";
import { LicenseWizard } from "@/components/admin/licence/license-wizard";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Nouveau client" };

export default function NewLicenseClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        backHref="/admin/licences"
        title="Nouveau client"
        description="Après la démonstration : créez son application, activez sa licence et envoyez-lui ses accès."
      />
      <LicenseWizard />
    </div>
  );
}
