"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="text-2xl font-semibold">{t("unexpectedError")}</h1>
      <p className="my-5 text-muted-foreground">{t("requestError")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
