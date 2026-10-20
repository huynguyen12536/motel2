"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { easeOutCubic } from "@/features/dashboard/utils/dashboard.utils";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountUp(target: number, durationMs = 1000, element?: RefObject<HTMLElement | null>) {
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(!element);
  const current = useRef(0);

  useEffect(() => {
    const node = element?.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const from = current.current;

    if (prefersReducedMotion()) {
      frame = requestAnimationFrame(() => {
        setValue(target);
        current.current = target;
      });
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      current.current = from + (target - from) * easeOutCubic(progress);
      setValue(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, visible]);

  return value;
}
