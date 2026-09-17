import type { ReactNode } from "react";
import Image from "next/image";
import { Be_Vietnam_Pro } from "next/font/google";
import { cn } from "@/lib/utils/cn";
import { AuthLocaleSwitch } from "./auth-locale-switch";
import "./auth-scene.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export function AuthScene({ children }: { children: ReactNode }) {
  return (
    <main
      className={cn(
        "auth-scene",
        beVietnamPro.variable,
        beVietnamPro.className,
      )}
      suppressHydrationWarning
    >
      <Image
        src="/images/auth/BackgroundLogin.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="auth-scene__image"
        aria-hidden="true"
      />
      <div className="auth-scene__veil" aria-hidden="true" />
      <AuthLocaleSwitch />
      <div className="auth-scene__stage">
        <div className="auth-card">{children}</div>
      </div>
      <p className="auth-page-footer">APA Nano</p>
    </main>
  );
}
