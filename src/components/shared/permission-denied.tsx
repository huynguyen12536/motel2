"use client";
import { useTranslations } from "next-intl";
export function PermissionDenied() {
  const t = useTranslations();
  return (
    <section role="alert" className="py-12">
      <h1 className="text-2xl font-semibold">{t("accessDenied")}</h1>
      <p className="mt-3 text-muted-foreground">
        {t("accessDeniedDescription")}
      </p>
    </section>
  );
}
