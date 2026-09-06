import { Layers2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { site } from "@/config/site";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <Layers2 />
          {site.name}
        </div>
        <div className="max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            {t("authHeadline")}
          </h2>
          <p className="mt-6 max-w-sm text-base leading-7 opacity-90">
            {t("authDescription")}
          </p>
        </div>
        <p className="text-sm opacity-80">{t("authFooter")}</p>
      </section>
      <section className="flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 font-semibold lg:hidden">
            <Layers2 className="text-primary" />
            {site.name}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
