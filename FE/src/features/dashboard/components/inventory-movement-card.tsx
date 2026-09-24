"use client";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DASHBOARD_COLORS } from "@/features/dashboard/constants/dashboard.constants";
import {
  getInventoryMovement,
  INVENTORY_RANGE_OPTIONS,
} from "@/features/dashboard/mocks/dashboard.mock";
import type { InventoryRangeKey } from "@/features/dashboard/types/dashboard.types";

const SERIES_LEGEND = [
  { key: "received", label: "Nhập", color: DASHBOARD_COLORS.receivedBar },
  { key: "issued", label: "Xuất", color: DASHBOARD_COLORS.issuedBar },
  { key: "stock", label: "Tồn", color: DASHBOARD_COLORS.stockLine },
] as const;

function MovementTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string | number;
  }>;
}) {
  if (!active || !payload?.length) return null;

  const seen = new Set<string>();
  const rows = payload.filter((entry) => {
    const id = String(entry.dataKey ?? entry.name ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return (
    <div className="wms-chart-tooltip">
      <p className="wms-chart-tooltip__title">{label}</p>
      <ul className="wms-chart-tooltip__list">
        {rows.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)}>
            <span
              className="wms-chart-tooltip__dot"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            {entry.name}: <strong>{entry.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InventoryMovementCard({
  initialRange = "7d",
}: {
  initialRange?: InventoryRangeKey;
}) {
  const [range, setRange] = useState<InventoryRangeKey>(initialRange);
  const points = useMemo(() => getInventoryMovement(range), [range]);
  const rangeLabel =
    INVENTORY_RANGE_OPTIONS.find((item) => item.value === range)?.label ??
    range;
  const summary =
    points.length > 0
      ? `Tồn kho từ ${points[0].stock} lên ${points[points.length - 1].stock} trong ${rangeLabel}.`
      : "Chưa có dữ liệu biến động tồn kho.";

  return (
    <section className="wms-card wms-card--analytics wms-card--bi" aria-label={summary}>
      <div className="wms-card__head">
        <div className="min-w-0">
          <h2 className="wms-card__title">Biến động tồn kho</h2>
          <p className="wms-card__subtitle">Nhập · Xuất · Tồn theo thời gian</p>
        </div>
        <div className="wms-chart-toolbar">
          <label className="wms-range-select">
            <span className="sr-only">Lọc khoảng thời gian biểu đồ</span>
            <select
              className="wms-range-select__control"
              value={range}
              onChange={(event) =>
                setRange(event.target.value as InventoryRangeKey)
              }
            >
              {INVENTORY_RANGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {points.length === 0 ? (
        <p className="wms-empty">
          Chưa có dữ liệu trong khoảng thời gian này.
        </p>
      ) : (
        <>
          <div className="wms-chart wms-chart--bi wms-chart--framed">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                key={range}
                data={points}
                margin={{ top: 28, right: 16, left: 4, bottom: 8 }}
                barCategoryGap="28%"
              >
                <defs>
                  <linearGradient id="wmsStockFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={DASHBOARD_COLORS.stockFill}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={DASHBOARD_COLORS.stockFill}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#E6EDF5"
                  strokeDasharray="0"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: "#CBD5E1", strokeWidth: 1 }}
                  tickLine={{ stroke: "#CBD5E1" }}
                  dy={8}
                />
                <YAxis
                  tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: "#CBD5E1", strokeWidth: 1 }}
                  tickLine={{ stroke: "#CBD5E1" }}
                  width={44}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.12)]}
                />
                <Tooltip
                  content={<MovementTooltip />}
                  cursor={{ fill: "rgba(129,140,248,0.08)" }}
                  animationDuration={120}
                />
                <Area
                  type="monotone"
                  dataKey="stock"
                  name="Tồn"
                  stroke="transparent"
                  fill="url(#wmsStockFill)"
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive
                  animationDuration={500}
                  animationEasing="ease-out"
                />
                <Bar
                  dataKey="received"
                  name="Nhập"
                  fill={DASHBOARD_COLORS.receivedBar}
                  radius={[5, 5, 0, 0]}
                  barSize={10}
                  isAnimationActive
                  animationBegin={80}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
                <Bar
                  dataKey="issued"
                  name="Xuất"
                  fill={DASHBOARD_COLORS.issuedBar}
                  radius={[5, 5, 0, 0]}
                  barSize={10}
                  isAnimationActive
                  animationBegin={110}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="stock"
                  name="Tồn"
                  stroke={DASHBOARD_COLORS.stockLine}
                  strokeWidth={2.25}
                  dot={{
                    r: 3.5,
                    fill: "#fff",
                    strokeWidth: 2,
                    stroke: DASHBOARD_COLORS.stockLine,
                  }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationBegin={160}
                  animationDuration={550}
                  animationEasing="ease-out"
                >
                  <LabelList
                    dataKey="stock"
                    position="top"
                    offset={8}
                    className="wms-chart-label wms-chart-label--strong"
                    fontSize={11}
                    fontWeight={600}
                    fill="#4338CA"
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ul
            className="wms-chart-legend wms-chart-legend--below"
            aria-label="Chú thích biểu đồ"
          >
            {SERIES_LEGEND.map((item) => (
              <li key={item.key} className="wms-chart-legend__item">
                <span
                  className="wms-chart-legend__dot"
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
                {item.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
