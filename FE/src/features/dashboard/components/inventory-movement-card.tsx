"use client";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DASHBOARD_COLORS } from "@/features/dashboard/constants/dashboard.constants";
import type { InventoryMovementPoint } from "@/features/dashboard/types/dashboard.types";

function MovementTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="wms-chart-tooltip">
      <p className="wms-chart-tooltip__title">{label}</p>
      <ul className="wms-chart-tooltip__list">
        {payload.map((entry) => (
          <li key={String(entry.name)}>
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
  points,
}: {
  points: InventoryMovementPoint[];
}) {
  return (
    <section className="wms-card">
      <div className="wms-card__head">
        <h2 className="wms-card__title">Biến động tồn kho</h2>
        <span className="wms-card__filter">7 ngày qua</span>
      </div>
      {points.length === 0 ? (
        <p className="wms-empty">Chưa có dữ liệu biến động tồn kho.</p>
      ) : (
        <div className="wms-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={points}
              margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={DASHBOARD_COLORS.stockLine}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor={DASHBOARD_COLORS.stockLine}
                    stopOpacity={0.02}
                  />
                </linearGradient>
                <linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={DASHBOARD_COLORS.receivedBar}
                    stopOpacity={0.95}
                  />
                  <stop
                    offset="100%"
                    stopColor={DASHBOARD_COLORS.receivedBar}
                    stopOpacity={0.55}
                  />
                </linearGradient>
                <linearGradient id="issuedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={DASHBOARD_COLORS.issuedBar}
                    stopOpacity={0.95}
                  />
                  <stop
                    offset="100%"
                    stopColor={DASHBOARD_COLORS.issuedBar}
                    stopOpacity={0.55}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#EEF2F7"
                strokeDasharray="0"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                content={<MovementTooltip />}
                cursor={{ fill: "rgb(37 99 235 / 0.04)" }}
                animationDuration={150}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              <Area
                type="monotone"
                dataKey="stock"
                name="Tồn kho"
                stroke="transparent"
                fill="url(#stockFill)"
                isAnimationActive
                animationDuration={650}
                legendType="none"
              />
              <Bar
                dataKey="received"
                name="Nhập"
                fill="url(#receivedFill)"
                radius={[5, 5, 0, 0]}
                barSize={12}
                isAnimationActive
                animationDuration={550}
              />
              <Bar
                dataKey="issued"
                name="Xuất"
                fill="url(#issuedFill)"
                radius={[5, 5, 0, 0]}
                barSize={12}
                isAnimationActive
                animationDuration={550}
              />
              <Line
                type="monotone"
                dataKey="stock"
                name="Tồn kho"
                stroke={DASHBOARD_COLORS.stockLine}
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={700}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
