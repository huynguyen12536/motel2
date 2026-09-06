export function formatCurrency(value: number, currency: string, locale = "en") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    value,
  );
}
