"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AppSelect({ value, onValueChange, options, label, id, className, disabled }: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} className={className}><SelectValue /></SelectTrigger>
      <SelectContent position="popper" align="end" className="wms-glass-panel" data-material="floating">
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
