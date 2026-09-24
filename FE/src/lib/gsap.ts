/**
 * Shared GSAP setup for the WMS APA Nano frontend.
 *
 * Install: `pnpm add gsap @gsap/react` (GSAP ≥ 3.13 from public npm — no greensock .npmrc).
 *
 * Usage in client components:
 *
 *   import { gsap, useGSAP } from "@/lib/gsap";
 *
 *   useGSAP(() => {
 *     gsap.from(".wms-kpi", { opacity: 0, y: 8, stagger: 0.04, duration: 0.26 });
 *   }, { dependencies: [] });
 *
 * Register extra plugins only where needed, e.g.:
 *   import { ScrollTrigger } from "gsap/ScrollTrigger";
 *   gsap.registerPlugin(ScrollTrigger);
 */
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };
