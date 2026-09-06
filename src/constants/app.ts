export const PAGE_SIZE = 8;
export const LOCALES = ["en", "fr", "de", "vi"] as const;
export type Locale = (typeof LOCALES)[number];
