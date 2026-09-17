"use client";
import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALES, type Locale } from "@/constants/app";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  vi: "Tiếng Việt",
};

function subscribe() {
  return () => {};
}

export function AuthLocaleSwitch() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  // Radix Select + browser/tool attrs (Bitwarden, Cursor refs) mismatch SSR HTML.
  if (!mounted) {
    return (
      <div className="auth-locale" aria-hidden="true">
        <div className="auth-locale-trigger flex h-8 w-[9.5rem] items-center gap-2 rounded-md border px-2 text-sm opacity-0">
          <Globe size={15} />
          <span>{LABELS[locale as Locale] ?? locale}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-locale">
      <Select
        value={locale}
        onValueChange={(value) => {
          document.cookie = `locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
          router.refresh();
        }}
      >
        <SelectTrigger
          id="auth-locale"
          aria-label={t("language")}
          size="sm"
          className="auth-locale-trigger"
        >
          <Globe size={15} aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          align="end"
          position="popper"
          className="auth-locale-menu"
        >
          {LOCALES.map((item) => (
            <SelectItem key={item} value={item} className="auth-locale-item">
              {LABELS[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
