"use client";
import type { InputHTMLAttributes, Ref } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordField({
  id,
  invalid,
  describedBy,
  visible,
  onToggle,
  registration,
}: {
  id: string;
  invalid: boolean;
  describedBy: string;
  visible: boolean;
  onToggle: () => void;
  registration: InputHTMLAttributes<HTMLInputElement> & {
    ref?: Ref<HTMLInputElement>;
  };
}) {
  return (
    <div className="login-field">
      <svg
        className="login-field__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="5"
          y="11"
          width="14"
          height="10"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 11V8a4 4 0 0 1 8 0v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <Input
        id={id}
        className="login-input"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Nhập mật khẩu"
        aria-invalid={invalid}
        aria-describedby={invalid ? describedBy : undefined}
        {...registration}
      />
      <button
        type="button"
        className="login-password-toggle"
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        onClick={onToggle}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
