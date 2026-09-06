import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
export function LoadingState() {
  const t = useTranslations();
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      {t("loading")}
    </div>
  );
}
