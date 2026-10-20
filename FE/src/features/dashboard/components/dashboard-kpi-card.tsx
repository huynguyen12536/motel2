"use client";
import { useRef } from "react";
import type { MetricIconComponent } from "@/features/dashboard/components/dashboard-metric-icons";
import { gsap } from "@/lib/gsap";
import { useCountUp } from "@/features/dashboard/hooks/use-count-up";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { DashboardKpi } from "@/features/dashboard/types/dashboard.types";

export function DashboardKpiCard({
  kpi,
  icon: Icon,
  index = 0,
}: {
  kpi: DashboardKpi;
  icon: MetricIconComponent;
  index?: number;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const animated = useCountUp(kpi.value, 1100, cardRef);
  const iconRef = useRef<HTMLSpanElement>(null);

  const animateIcon = (active: boolean) => {
    const icon = iconRef.current;
    if (!icon || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    gsap.killTweensOf(icon.querySelectorAll("*"));
    gsap.to(icon.querySelector(".wms-metric-icon__core"), {
      rotate: active ? -4 : 0,
      scale: active ? 1.08 : 1,
      transformOrigin: "50% 50%",
      duration: active ? 0.34 : 0.22,
      ease: "power3.out",
    });
    gsap.to(icon.querySelectorAll(".wms-metric-icon__orbit"), {
      rotate: active ? 22 : 0,
      transformOrigin: "50% 50%",
      duration: active ? 0.48 : 0.25,
      ease: "power3.out",
    });
    gsap.fromTo(
      icon.querySelector(".wms-metric-icon__signal"),
      { strokeDasharray: 18, strokeDashoffset: active ? 18 : 0 },
      { strokeDashoffset: 0, duration: 0.42, ease: "power2.out" },
    );
  };

  return (
    <article
      ref={cardRef}
      className="wms-kpi"
      style={{ animationDelay: `${index * 40}ms` }}
      onMouseEnter={() => animateIcon(true)}
      onMouseLeave={() => animateIcon(false)}
    >
      <div className="wms-kpi__body">
        <span
          ref={iconRef}
          className={`wms-kpi__icon wms-kpi__icon--${kpi.tone}`}
          aria-hidden="true"
        >
          <Icon />
        </span>
        <div className="wms-kpi__content">
          <p className="wms-kpi__label truncate">{kpi.label}</p>
          <p className="wms-kpi__value" aria-label={formatDashboardNumber(kpi.value)}>
            <span aria-hidden="true">{formatDashboardNumber(animated)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
