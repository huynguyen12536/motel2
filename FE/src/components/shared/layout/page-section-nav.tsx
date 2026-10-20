"use client";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils/cn";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function PageSectionNav({ label, items, vertical = false }: {
  label: string;
  items: Array<{ id: string; label: string }>;
  vertical?: boolean;
}) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const current = items.some((item) => item.id === hash) ? hash : items[0]?.id;
  return (
    <nav aria-label={label} className={cn("wms-section-nav", vertical && "wms-section-nav--vertical")}>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} aria-current={current === item.id ? "location" : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
