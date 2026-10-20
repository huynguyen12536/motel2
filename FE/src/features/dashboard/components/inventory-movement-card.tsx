"use client";
import { useMemo, useState, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useCountUp } from "@/features/dashboard/hooks/use-count-up";
import { useTranslations } from "next-intl";
import { env } from "@/config/env";
import { getInventoryMovement, INVENTORY_RANGE_OPTIONS } from "@/features/dashboard/mocks/dashboard.mock";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { InventoryRangeKey } from "@/features/dashboard/types/dashboard.types";

const SERIES = ["received", "issued", "stock"] as const;
type Series = (typeof SERIES)[number];

export function InventoryMovementCard({ initialRange = "7d" }: { initialRange?: InventoryRangeKey }) {
  const t = useTranslations("chartUI");
  const [range, setRange] = useState<InventoryRangeKey>(initialRange);
  const [series, setSeries] = useState<Series>("stock");
  const points = useMemo(() => getInventoryMovement(range), [range]);
  const maximum = Math.max(1, ...points.map((point) => point[series]));
  const step = Math.max(1, 10 ** Math.floor(Math.log10(maximum)) / 2);
  const ceiling = Math.ceil(maximum / step) * step;
  const latest = points.at(-1);
  const cardRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const animatedTotal = useCountUp(latest?.[series] ?? 0, 1000, cardRef);
  const rangeKeys = { "7d": "range7d", "30d": "range30d", "3m": "range3m", "12m": "range12m" } as const;

  return (
    <section ref={cardRef} className="wms-card wms-card--analytics wms-card--bi wms-reference-revenue" aria-label={t("inventoryTitle")}>
      <header className="wms-reference-chart__head">
        <h2 className="wms-card__title">{t("inventoryTitle")}</h2>
        {env.demoMode && <span className="wms-chart-demo">{t("demo")}</span>}
        {latest && <strong className="wms-reference-chart__value" aria-label={formatDashboardNumber(latest[series])}><span aria-hidden="true">{formatDashboardNumber(animatedTotal)}</span></strong>}
        {latest && <span className="wms-reference-chart__caption">{t("latest")} · {latest.date}</span>}
      </header>
      <div className="wms-reference-chart__controls">
        <div className="wms-segmented" role="group" aria-label={t("period")}>
          {INVENTORY_RANGE_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={range === option.value} onClick={() => setRange(option.value)}>
              {t(rangeKeys[option.value])}
            </button>
          ))}
        </div>
        <div className="wms-segmented" role="group" aria-label={t("series")}>
          {SERIES.map((key) => (
            <button key={key} type="button" aria-pressed={series === key} onClick={() => setSeries(key)}>{t(key)}</button>
          ))}
        </div>
      </div>
      {!points.length ? <p className="wms-empty">{t("empty")}</p> : (
        <div className="wms-reference-bars" role="group" aria-label={`${t(series)} · ${t(rangeKeys[range])}`}>
          <div className="wms-reference-bars__axis" aria-hidden="true">
            {[1, 0.75, 0.5, 0.25, 0].map((fraction) => <span key={fraction}>{formatDashboardNumber(ceiling * fraction)}</span>)}
          </div>
          <div className="wms-reference-bars__plot">
            <div className="wms-reference-bars__grid" aria-hidden="true">{[0, 1, 2, 3, 4].map((line) => <span key={line} />)}</div>
            <div key={`${range}-${series}`} className="wms-reference-bars__columns" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
              {points.map((point, index) => (
                <div className="wms-reference-bars__column" key={point.date}>
                  <motion.button type="button" className="wms-reference-bars__bar" data-current={index === points.length - 1 || undefined}
                    initial={reducedMotion ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : Math.min(index * 0.025, 0.2), ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: `${point[series] / ceiling * 100}%`, minHeight: 3, transformOrigin: "center bottom" }}
                    aria-label={`${point.date}: ${t(series)} ${formatDashboardNumber(point[series])}`}>
                    <span className="wms-reference-bars__tooltip">{point.date}<strong>{t(series)}: {formatDashboardNumber(point[series])}</strong></span>
                  </motion.button>
                  <span className="wms-reference-bars__label" data-current={index === points.length - 1 || undefined}>{point.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
