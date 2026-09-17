"use client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSidebarStore } from "@/stores/sidebar.store";
import { SidebarBrand, SidebarNav } from "@/components/layout/sidebar-nav";

export function MobileSidebar({ open }: { open: boolean }) {
  const close = useSidebarStore((state) => state.close);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 top-0 left-0 h-dvh w-[min(280px,88vw)] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-y-0 border-l-0 bg-transparent p-0 duration-200 data-[state=closed]:slide-out-to-left data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-left data-[state=open]:zoom-in-100 sm:max-w-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Menu điều hướng</DialogTitle>
        <div className="wms-side wms-drawer">
          <SidebarBrand />
          <SidebarNav onNavigate={close} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
