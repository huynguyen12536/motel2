"use client";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DASHBOARD_COLORS } from "@/features/dashboard/constants/dashboard.constants";
import { formatDashboardNumber } from "@/features/dashboard/utils/dashboard.utils";
import type { MaterialGroup } from "@/features/dashboard/types/dashboard.types";

function GroupTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MaterialGroup }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="wms-chart-tooltip">
      <p className="wms-chart-tooltip__title">{item.name}</p>
      <p className="wms-chart-tooltip__value">
        {formatDashboardNumber(item.value)} vật liệu
      </p>
    </div>
  );
}

export function MaterialGroupChart({ items }: { items: MaterialGroup[] }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const summary =
    sorted.length > 0
      ? `Top nhóm: ${sorted[0].name} với ${sorted[0].value} vật liệu.`
      : "Chưa có dữ liệu nhóm vật liệu.";

  return (
    <section className="wms-card wms-card--analytics wms-card--bi" aria-label={summary}>
      <div className="wms-card__head">
        <h2 className="wms-card__title">Top 5 nhóm vật liệu</h2>
      </div>
      {sorted.length === 0 ? (
        <p className="wms-empty">
          Chưa có dữ liệu trong khoảng thời gian này.
        </p>
      ) : (
        <div className="wms-chart wms-chart--bars wms-chart--bi">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 4, right: 36, left: 0, bottom: 4 }}
              barCategoryGap="18%"
            >
              <XAxis type="number" hide domain={[0, "dataMax + 40"]} />
              <YAxis
                type="category"
                dataKey="name"
                width={112}
                tick={{ fill: "#64748B", fontSize: 12, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<GroupTooltip />}
                cursor={{ fill: "rgba(165,180,252,0.12)" }}
                animationDuration={120}
              />
              <Bar
                dataKey="value"
                fill={DASHBOARD_COLORS.barPrimary}
                radius={[0, 8, 8, 0]}
                barSize={16}
                isAnimationActive
                animationBegin={150}
                animationDuration={600}
                animationEasing="ease-out"
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  className="wms-chart-label wms-chart-label--strong"
                  fontSize={12}
                  fontWeight={600}
                  fill="#4338CA"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
