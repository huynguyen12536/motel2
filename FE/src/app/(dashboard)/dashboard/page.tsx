import { getTranslations } from "next-intl/server";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("dashboard") };
}

export default function DashboardPage() {
  return <DashboardOverview />;
}
