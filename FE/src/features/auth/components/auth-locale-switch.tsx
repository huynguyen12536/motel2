"use client";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALES } from "@/constants/app";

const LABELS: Record<(typeof LOCALES)[number], string> = {
  en: "EN",
  fr: "FR",
  de: "DE",
  vi: "VI",
};

export function AuthLocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  return (
    <div className="auth-locale" role="group" aria-label="Ngôn ngữ">
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          className={locale === item ? "is-active" : undefined}
          aria-pressed={locale === item}
          onClick={() => {
            document.cookie = `locale=${item}; Path=/; Max-Age=31536000; SameSite=Lax`;
            router.refresh();
          }}
        >
          {LABELS[item]}
        </button>
      ))}
    </div>
  );
}
