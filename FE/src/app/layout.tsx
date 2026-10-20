import type { Metadata } from "next";
import Script from "next/script";
import { Source_Sans_3 } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { AppProvider } from "@/providers/app-provider";
import { site } from "@/config/site";
import "./globals.css";

const appFont = Source_Sans_3({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-app",
});

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
      <body className={`${appFont.variable} ${appFont.className}`} suppressHydrationWarning>
        <Script
          src="/scripts/strip-password-manager-attrs.js"
          strategy="beforeInteractive"
        />
        <AppProvider locale={locale} messages={messages}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
