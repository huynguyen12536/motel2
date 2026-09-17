export function formatDashboardNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatCompactPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}
