"use client";

import { useEffect, useRef } from "react";
import { consumeScrollChain } from "@/lib/utils/scroll-chain";

/** Own nested wheel scrolling from its first event to avoid native scroll-latching. */
export function useScrollChain() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = ref.current;
    const workspace = page?.closest(".wms-shell__content");
    if (!page || !(workspace instanceof HTMLElement)) return;

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey ||
          !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest(
        ".wms-wh-viewer, textarea, select, [role='listbox'], [role='dialog'], [data-scroll-chain='ignore']",
      )) return;

      const chain: HTMLElement[] = [];
      for (let node: Element | null = target; node; node = node.parentElement) {
        if (node instanceof HTMLElement && /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) &&
            node.scrollHeight > node.clientHeight) chain.push(node);
        if (node === workspace) break;
      }
      if (chain.length < 2) return;

      const first = chain[0];
      const unit = event.deltaMode === 1
        ? parseFloat(getComputedStyle(first).lineHeight) || 16
        : event.deltaMode === 2 ? first.clientHeight : 1;
      const delta = event.deltaY * unit;
      // Do not mix native inner scrolling with manual boundary handoff. Chromium
      // can latch the gesture (or emit non-cancelable follow-up events) after an
      // uncanceled first wheel, leaving the handoff stuck until the next gesture.
      // One controller consumes the whole sequence, inner first, then outer.
      consumeScrollChain(event, delta, chain);
    };

    page.addEventListener("wheel", onWheel, { passive: false });
    return () => page.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}
