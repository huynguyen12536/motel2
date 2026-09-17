"use client";
import { useState } from "react";
import Link from "next/link";
import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { useSignIn } from "@/features/auth/hooks/use-sign-in";
import { PasswordField } from "@/features/auth/components/password-field";
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
  const t = useTranslations();
  const { form, mutation, expired } = useSignIn();
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <div className="login-panel">
      <div className="login-brand">
        <span className="login-brand__mark" aria-hidden="true" role="img" />
        <p className="login-brand__name">{t("productName")}</p>
      </div>

      <div className="login-heading">
        <h1 className="login-title">{t("signIn")}</h1>
        <p className="login-subtitle">{t("signInDescription")}</p>
      </div>

      <form
        noValidate
        className="login-form"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        {(expired || (mutation.isError && !mutation.isPending)) && (
          <p role="alert" className="login-alert">
            <CircleAlert size={16} aria-hidden="true" />
            {expired ? t("sessionExpired") : t("invalidCredentials")}
          </p>
        )}

        <div className="login-fields">
          <div>
            <Label htmlFor="email" className="login-label">
              {t("emailShort")}
            </Label>
            <div className="login-field">
              <svg
                className="login-field__icon"
                width="16"
                height="16"
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
                placeholder="you@company.com"
                aria-invalid={!!form.formState.errors.email}
                aria-describedby={
                  form.formState.errors.email ? "email-error" : undefined
                }
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email ? (
              <p id="email-error" className="login-field-error">
                {t("emailRequired")}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="password" className="login-label">
              {t("password")}
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
                {t("passwordRequired")}
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
              {t("remember")}
            </Label>
          </div>
          <Link href="/auth/forgot-password" className="login-forgot">
            {t("forgotPassword")}
          </Link>
        </div>

        <button
          className="login-submit"
          type="submit"
          disabled={mutation.isPending || mutation.isSuccess}
        >
          {mutation.isPending ? t("signingIn") : t("signIn")}
          {mutation.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
        </button>
      </form>

      <div className="login-divider">{t("orContinue")}</div>

      <div className="login-socials">
        <button type="button" className="login-social" aria-label="Google">
          <GoogleMark />
        </button>
        <button type="button" className="login-social" aria-label="Microsoft">
          <MicrosoftMark />
        </button>
      </div>

      <p className="login-footer">
        {t("noAccount")}{" "}
        <a href="mailto:admin@apa.local">{t("contactAdmin")}</a>
      </p>
    </div>
  );
}
