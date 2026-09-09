"use client";
import { useState } from "react";
import Link from "next/link";
import { Controller } from "react-hook-form";
import { CircleAlert, Cuboid, LoaderCircle, LogIn } from "lucide-react";
import { useSignIn } from "@/features/auth/hooks/use-sign-in";
import { PasswordField } from "@/features/auth/components/password-field";
import { MOCK_CREDENTIALS } from "@/features/auth/mocks/mock-auth";
import { env } from "@/config/env";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.17.26-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="#F25022" d="M0 0h7.6v7.6H0z" />
      <path fill="#7FBA00" d="M8.4 0H16v7.6H8.4z" />
      <path fill="#00A4EF" d="M0 8.4h7.6V16H0z" />
      <path fill="#FFB900" d="M8.4 8.4H16V16H8.4z" />
    </svg>
  );
}

export function SignInForm() {
  const { form, mutation, expired } = useSignIn();
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <div>
      <div className="login-brand">
        <span className="login-brand__mark" aria-hidden="true">
          <Cuboid size={18} />
        </span>
        <div>
          <p className="login-brand__name">WMS APA Nano</p>
          <p className="login-brand__subtitle">Warehouse Management System</p>
        </div>
      </div>
      <div className="login-heading">
        <p className="login-eyebrow">Chào mừng trở lại</p>
        <h1 className="login-title">Đăng nhập</h1>
        <p className="login-subtitle">
          Truy cập hệ thống quản lý kho WMS APA Nano
        </p>
      </div>
      <form
        noValidate
        className="login-form"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        {(expired || (mutation.isError && !mutation.isPending)) && (
          <p role="alert" className="login-alert">
            <CircleAlert size={17} aria-hidden="true" />
            {expired
              ? "Phiên đã hết hạn. Vui lòng đăng nhập lại."
              : "Tên đăng nhập hoặc mật khẩu không chính xác."}
          </p>
        )}
        <div className="login-fields">
          <div>
            <Label htmlFor="email" className="login-label">
              Tên đăng nhập hoặc email
            </Label>
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
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="m4 7 8 6 8-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <Input
                id="email"
                className="login-input"
                type="text"
                autoComplete="username"
                placeholder="Nhập tên đăng nhập hoặc email"
                aria-invalid={!!form.formState.errors.email}
                aria-describedby={
                  form.formState.errors.email ? "email-error" : undefined
                }
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email ? (
              <p id="email-error" className="login-field-error">
                Vui lòng nhập tên đăng nhập hoặc email.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="password" className="login-label">
              Mật khẩu
            </Label>
            <PasswordField
              id="password"
              invalid={!!form.formState.errors.password}
              describedBy="password-error"
              visible={passwordVisible}
              onToggle={() => setPasswordVisible((value) => !value)}
              registration={form.register("password")}
            />
            {form.formState.errors.password ? (
              <p id="password-error" className="login-field-error">
                Vui lòng nhập mật khẩu.
              </p>
            ) : null}
          </div>
        </div>
        <div className="login-meta">
          <div className="login-remember">
            <Controller
              control={form.control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  id="remember"
                  className="login-checkbox"
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
              )}
            />
            <Label htmlFor="remember" className="login-remember-label">
              Ghi nhớ đăng nhập
            </Label>
          </div>
          <Link href="/auth/forgot-password" className="login-forgot">
            Quên mật khẩu?
          </Link>
        </div>
        <button
          className="login-submit"
          type="submit"
          disabled={mutation.isPending || mutation.isSuccess}
        >
          {mutation.isPending ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <LogIn size={18} />
          )}
          {mutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      <div className="login-divider">hoặc đăng nhập bằng</div>
      <div className="login-socials">
        <button type="button" className="login-social">
          <GoogleMark />
          Google
        </button>
        <button type="button" className="login-social">
          <MicrosoftMark />
          Microsoft
        </button>
      </div>
      <p className="login-footer">
        Chưa có tài khoản?{" "}
        <a href="mailto:admin@apa.local">Liên hệ quản trị hệ thống</a>
      </p>
      {env.demoMode ? (
        <p className="login-demo">
          Tài khoản demo: {MOCK_CREDENTIALS.email} / {MOCK_CREDENTIALS.password}
        </p>
      ) : null}
    </div>
  );
}
