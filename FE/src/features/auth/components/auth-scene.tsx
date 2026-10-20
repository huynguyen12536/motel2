import type { ReactNode } from "react";
import Image from "next/image";
import { AuthLocaleSwitch } from "./auth-locale-switch";
import "./auth-scene.css";

export function AuthScene({ children }: { children: ReactNode }) {
  return (
    <main
      className="auth-scene"
      suppressHydrationWarning
    >
      <Image
        src="/images/compta-workspace-bg.png"
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
