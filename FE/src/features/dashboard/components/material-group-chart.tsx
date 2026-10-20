"use client";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useCountUp } from "@/features/dashboard/hooks/use-count-up";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { MaterialGroup } from "@/features/dashboard/types/dashboard.types";

const COLORS = ["var(--chart-1)", "#1fd2d8", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function MaterialGroupChart({ items }: { items: MaterialGroup[] }) {
  const t = useTranslations("chartUI");
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const cardRef = useRef<HTMLElement>(null);
  const animated = useCountUp(total, 1000, cardRef);
  const reducedMotion = useReducedMotion();
  return (
    <section ref={cardRef} className="wms-card wms-card--analytics wms-card--bi">
      <header className="wms-card__head"><h2 className="wms-card__title">{t("groupsTitle")}</h2></header>
      {!sorted.length || total === 0 ? <p className="wms-empty">{t("empty")}</p> : (
        <div className="wms-reference-breakdown">
          <div className="wms-reference-breakdown__chart" role="img" aria-label={sorted.map((item) => `${item.name}: ${formatDashboardNumber(item.value)}`).join(", ")}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sorted} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="88%" paddingAngle={2}
                  startAngle={90} endAngle={-270} stroke="none" isAnimationActive={!reducedMotion} animationDuration={900} animationEasing="ease-out">
                  {sorted.map((item, index) => <Cell key={item.id} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#142746", border: 0, borderRadius: 9, color: "#fff", fontSize: 12 }} itemStyle={{ color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="wms-reference-breakdown__center"><strong>{formatDashboardNumber(animated)}</strong><span>{t("shownGroups")}</span></div>
          </div>
          <ul className="wms-reference-breakdown__legend">
            {sorted.map((item, index) => (
              <li key={item.id}>
                <span className="wms-reference-breakdown__swatch" style={{ background: COLORS[index % COLORS.length] }} aria-hidden="true" />
                <span>{item.name}</span><strong>{formatDashboardNumber(item.value)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
