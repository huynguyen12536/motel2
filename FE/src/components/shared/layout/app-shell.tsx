"use client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSidebarStore } from "@/stores/sidebar.store";
import { Sidebar } from "@/components/shared/layout/sidebar";
import { Header } from "@/components/shared/layout/header";
export function AppShell({ children }: { children: React.ReactNode }) {
  const open = useSidebarStore((state) => state.open);
  const close = useSidebarStore((state) => state.close);
  const desktop = useMediaQuery("(min-width: 768px)");
  const t = useTranslations();
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-card focus:p-4"
      >
        {t("skipContent")}
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r md:block">
        <Sidebar />
      </aside>
      <Dialog
        open={open && !desktop}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="fixed inset-y-0 left-0 h-dvh w-72 translate-x-0 translate-y-0 rounded-none p-0"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{t("mainNavigation")}</DialogTitle>
          <Sidebar />
        </DialogContent>
      </Dialog>
      <div className="md:pl-60">
        <Header />
        <main
          id="main-content"
          className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
