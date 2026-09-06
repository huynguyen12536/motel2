import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-4 text-3xl font-semibold">{t("notFound")}</h1>
      <p className="my-5 text-muted-foreground">{t("notFoundDescription")}</p>
      <Button asChild>
        <Link href="/dashboard">{t("backDashboard")}</Link>
      </Button>
    </main>
  );
}
