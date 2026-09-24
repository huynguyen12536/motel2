"use client";
import { useRef, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
} from "recharts";
import { gsap, useGSAP } from "@/lib/gsap";
import { useCountUp } from "@/features/dashboard/hooks/use-count-up";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { QualityStatusItem } from "@/features/dashboard/types/dashboard.types";

type SectorShapeProps = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  isActive?: boolean;
};

type SectorEventData = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  payload?: QualityStatusItem;
};

type TipState = {
  item: QualityStatusItem;
  x: number;
  y: number;
  side: "left" | "right";
};

const TIP_W = 128;
const TIP_H = 78;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function tipFromSector(
  data: SectorEventData,
  item: QualityStatusItem,
  chartW: number,
  chartH: number,
): TipState {
  const RADIAN = Math.PI / 180;
  const mid = data.midAngle ?? 0;
  const cx = data.cx ?? chartW / 2;
  const cy = data.cy ?? chartH / 2;
  const outer = data.outerRadius ?? Math.min(chartW, chartH) * 0.34;
  const cos = Math.cos(-mid * RADIAN);
  const sin = Math.sin(-mid * RADIAN);
  const side: TipState["side"] = cos >= 0 ? "right" : "left";
  const gap = 22;

  let x = cx + (outer + gap) * cos;
  let y = cy + (outer + gap) * sin;

  // Keep tip inside chart box so it never sits on the legend below.
  const pad = 10;
  if (side === "right") {
    x = Math.min(Math.max(x, cx + outer * 0.35), chartW - TIP_W - pad);
  } else {
    x = Math.max(Math.min(x, cx - outer * 0.35), TIP_W + pad);
  }
  y = Math.min(Math.max(y, TIP_H / 2 + pad), chartH - TIP_H / 2 - pad);

  return { item, x, y, side };
}

export function QualityStatusCard({
  items,
  totalLots,
}: {
  items: QualityStatusItem[];
  totalLots: number;
}) {
  const animatedTotal = useCountUp(totalLots, 500);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!tipRef.current || !tip) return;
      if (prefersReducedMotion()) {
        gsap.set(tipRef.current, { autoAlpha: 1, y: 0, scale: 1 });
        return;
      }
      gsap.fromTo(
        tipRef.current,
        { autoAlpha: 0, y: 10, scale: 0.94 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.34,
          ease: "power3.out",
          overwrite: true,
        },
      );
    },
    { dependencies: [tip?.item.code] },
  );

  const bounceSector = (
    target: Element,
    cx: number,
    cy: number,
    expand: boolean,
  ) => {
    gsap.killTweensOf(target);
    if (prefersReducedMotion()) {
      gsap.set(target, {
        scale: expand ? 1.06 : 1,
        svgOrigin: `${cx} ${cy}`,
      });
      return;
    }
    if (expand) {
      gsap.fromTo(
        target,
        { scale: 1 },
        {
          scale: 1.07,
          duration: 0.68,
          ease: "elastic.out(1, 0.5)",
          svgOrigin: `${cx} ${cy}`,
          overwrite: true,
        },
      );
      return;
    }
    gsap.to(target, {
      scale: 1,
      duration: 0.26,
      ease: "power2.out",
      svgOrigin: `${cx} ${cy}`,
      overwrite: true,
    });
  };

  const handleEnter = (
    data: SectorEventData,
    index: number,
    event: React.MouseEvent<SVGElement>,
  ) => {
    const item = items[index] ?? data.payload;
    if (!item) return;
    const rect = chartRef.current?.getBoundingClientRect();
    const chartW = rect?.width ?? 280;
    const chartH = rect?.height ?? 248;
    setHoverIndex(index);
    setTip(tipFromSector(data, item, chartW, chartH));
    bounceSector(event.currentTarget, data.cx ?? 0, data.cy ?? 0, true);
  };

  const handleLeave = (
    data: SectorEventData,
    _index: number,
    event: React.MouseEvent<SVGElement>,
  ) => {
    bounceSector(event.currentTarget, data.cx ?? 0, data.cy ?? 0, false);
    setHoverIndex(null);
    setTip(null);
  };

  const renderSector = (props: SectorShapeProps) => {
    const {
      cx = 0,
      cy = 0,
      innerRadius = 0,
      outerRadius = 0,
      startAngle = 0,
      endAngle = 0,
      fill = "#2563EB",
      isActive = false,
    } = props;

    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff"
        strokeWidth={3}
        fillOpacity={hoverIndex !== null && !isActive ? 0.7 : 1}
        style={{ cursor: "pointer" }}
      />
    );
  };

  const summary =
    items.length > 0
      ? `Chất lượng: ${items.map((i) => `${i.label} ${i.percent}%`).join(", ")}.`
      : "Chưa có dữ liệu chất lượng.";

  return (
    <section className="wms-card wms-card--analytics wms-card--bi" aria-label={summary}>
      <div className="wms-card__head">
        <h2 className="wms-card__title">Tình trạng chất lượng vật liệu</h2>
      </div>
      {items.length === 0 ? (
        <p className="wms-empty">
          Chưa có dữ liệu trong khoảng thời gian này.
        </p>
      ) : (
        <div className="wms-quality wms-quality--bi">
          <div ref={chartRef} className="wms-quality__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                <Pie
                  data={items}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="46%"
                  outerRadius="62%"
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="#fff"
                  strokeWidth={3}
                  isAnimationActive
                  animationBegin={0}
                  animationDuration={700}
                  animationEasing="ease-out"
                  shape={renderSector}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                >
                  {items.map((item) => (
                    <Cell key={item.code} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="wms-quality__center">
              <p className="wms-quality__total">
                {formatDashboardNumber(animatedTotal)}
              </p>
              <p className="wms-quality__total-label">Tổng số lô</p>
            </div>

            {tip ? (
              <div
                className={`wms-quality__tip-anchor wms-quality__tip-anchor--${tip.side}`}
                style={{ left: tip.x, top: tip.y }}
              >
                <div
                  ref={tipRef}
                  className="wms-quality__tip"
                  role="status"
                >
                  <p className="wms-quality__tip-label">{tip.item.label}</p>
                  <p className="wms-quality__tip-percent">{tip.item.percent}%</p>
                  <p className="wms-quality__tip-value">
                    {formatDashboardNumber(tip.item.value)} lô
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          <ul className="wms-quality__legend">
            {items.map((item, index) => (
              <li
                key={item.code}
                className="wms-quality__legend-item"
                style={{ animationDelay: `${400 + index * 40}ms` }}
              >
                <span
                  className="wms-quality__swatch"
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
                <span className="wms-quality__legend-label">
                  {item.label}
                  <span className="sr-only">
                    {" "}
                    {item.percent}% · {formatDashboardNumber(item.value)} lô
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
