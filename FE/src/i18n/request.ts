import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALES, type Locale } from "@/constants/app";
export default getRequestConfig(async () => {
  const value = (await cookies()).get("locale")?.value;
  const locale = LOCALES.includes(value as Locale) ? (value as Locale) : "en";
  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
