"use client";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { QualityStatusItem } from "@/features/dashboard/types/dashboard.types";

export function QualityStatusCard({ items, totalLots }: { items: QualityStatusItem[]; totalLots: number }) {
  const t = useTranslations("chartUI");
  const reducedMotion = useReducedMotion();
  const summary = items.map((item) => `${item.label}: ${item.percent}%`).join(", ");
  return (
    <section className="wms-card wms-card--analytics wms-card--bi">
      <header className="wms-card__head">
        <div>
          <h2 className="wms-card__title">{t("qualityTitle")}</h2>
          <p className="wms-card__subtitle">{t("totalLots", { count: formatDashboardNumber(totalLots) })}</p>
        </div>
      </header>
      {!items.length ? <p className="wms-empty">{t("empty")}</p> : (
        <div className="wms-reference-health">
          <div className="wms-reference-health__radar" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={items} outerRadius="76%" margin={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <PolarGrid stroke="var(--chart-grid)" />
                <PolarAngleAxis dataKey="label" tick={false} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="percent" stroke="#1fd2d8" strokeWidth={1.5} fill="#1fd2d8" fillOpacity={0.22}
                  dot={{ r: 2.5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 1 }} isAnimationActive={!reducedMotion} animationDuration={900} animationEasing="ease-out" />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <dl className="wms-reference-health__metrics">
            {items.map((item) => (
              <div key={item.code}>
                <dt>{item.label}</dt>
                <dd><strong>{item.percent}%</strong><span className="sr-only"> · {formatDashboardNumber(item.value)}</span></dd>
                <div className="wms-reference-health__track" aria-hidden="true"><motion.span initial={reducedMotion ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: reducedMotion ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }} style={{ width: `${item.percent}%`, transformOrigin: "left center" }} /></div>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
