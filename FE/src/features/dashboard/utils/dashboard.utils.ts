export function formatDashboardNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value));
}

export function formatCompactPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function buildSparklinePath(
  values: number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
