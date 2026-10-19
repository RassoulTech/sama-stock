import { PageHeader } from "@/components/shared/page-header";
import { requireContext } from "@/server/context";

export default async function DashboardPage() {
  const ctx = await requireContext();
  return <PageHeader title={`Bonjour ${ctx.user.name.split(" ")[0]}`} description="Tableau de bord" />;
}
