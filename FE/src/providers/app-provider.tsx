"use client";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
export function AppProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ThemeProvider>
        <QueryProvider>
          {children}
          <Toaster richColors />
        </QueryProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
