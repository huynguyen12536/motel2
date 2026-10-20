import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

export function PageFrame({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-frame"
      className={cn("min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl bg-surface p-3 lg:p-4", className)}
      {...props}
    />
  );
}
