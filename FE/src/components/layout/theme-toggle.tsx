"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import {
  TopbarMoonIcon,
  TopbarSunIcon,
} from "@/components/layout/topbar-icons";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const t = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="wms-circle-btn wms-circle-btn--theme"
      aria-label={isDark ? t("light") : t("dark")}
      title={isDark ? t("light") : t("dark")}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <TopbarSunIcon size={18} />
      ) : (
        <TopbarMoonIcon size={18} />
      )}
    </button>
  );
}
