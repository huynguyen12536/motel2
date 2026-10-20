"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { CalendarDays } from "lucide-react";
import { Popover } from "radix-ui";
import { DayPicker } from "react-day-picker";
import { vi, enUS, fr, de } from "react-day-picker/locale";
import "react-day-picker/style.css";
import "./date-picker.css";

export function DatePicker({ value, onChange, label, description }: {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  description: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const formatted = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="wms-date-trigger" aria-label={`${label}: ${formatted}`}>
          <CalendarDays size={16} aria-hidden="true" /><span>{formatted}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="wms-date-popover wms-glass-panel" data-material="floating" sideOffset={8} align="end" collisionPadding={12} aria-label={label}>
          <DayPicker className="wms-calendar" mode="single" required autoFocus showOutsideDays
            defaultMonth={value} selected={value} locale={({ vi, en: enUS, fr, de })[locale] ?? enUS}
            onSelect={(date) => { onChange(date); setOpen(false); }} />
          <p className="wms-calendar__note">{description}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
