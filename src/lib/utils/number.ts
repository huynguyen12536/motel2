export function formatNumber(value: number, locale = "en") {
  return new Intl.NumberFormat(locale).format(value);
}
