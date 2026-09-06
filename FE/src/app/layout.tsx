import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { AppProvider } from "@/providers/app-provider";
import { site } from "@/config/site";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <AppProvider locale={locale} messages={messages}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
