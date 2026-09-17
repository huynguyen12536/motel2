"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { QualityStatusItem } from "@/features/dashboard/types/dashboard.types";

function QualityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: QualityStatusItem }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="wms-chart-tooltip">
      <p className="wms-chart-tooltip__title">{item.label}</p>
      <p className="wms-chart-tooltip__value">
        {formatDashboardNumber(item.value)} lô · {item.percent}%
      </p>
    </div>
  );
}

export function QualityStatusCard({
  items,
  totalLots,
}: {
  items: QualityStatusItem[];
  totalLots: number;
}) {
  return (
    <section className="wms-card">
      <div className="wms-card__head">
        <h2 className="wms-card__title">Tình trạng chất lượng</h2>
      </div>
      {items.length === 0 ? (
        <p className="wms-empty">Chưa có dữ liệu chất lượng.</p>
      ) : (
        <div className="wms-quality">
          <div className="wms-quality__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="84%"
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive
                  animationBegin={80}
                  animationDuration={700}
                  animationEasing="ease-out"
                >
                  {items.map((item) => (
                    <Cell key={item.code} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<QualityTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="wms-quality__center">
              <p className="wms-quality__total">
                {formatDashboardNumber(totalLots)}
              </p>
              <p className="wms-quality__total-label">Tổng số lô</p>
            </div>
          </div>
          <ul className="wms-quality__legend">
            {items.map((item) => (
              <li key={item.code} className="wms-quality__legend-item">
                <span
                  className="wms-quality__swatch"
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
                <span className="wms-quality__legend-label">
                  {item.label}
                  <span className="sr-only">
                    {" "}
                    {item.code}: {item.percent}%
                  </span>
                </span>
                <span className="wms-quality__legend-value">
                  {formatDashboardNumber(item.value)} · {item.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
