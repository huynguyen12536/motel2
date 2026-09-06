"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { z } from "zod";
import {
  signUpSchema,
  forgotPasswordSchema,
} from "@/features/auth/schemas/auth.schema";
import {
  recoverAccount,
  registerAccount,
} from "@/features/auth/api/recover-account";
import { env } from "@/config/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type Values = { name?: string; email: string; password?: string };
export function AccountForm({ mode }: { mode: "register" | "recover" }) {
  const t = useTranslations();
  const register = mode === "register";
  const schema: z.ZodType<Values, Values> = register
    ? signUpSchema
    : forgotPasswordSchema;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      ...(register ? { name: "", password: "" } : {}),
    },
  });
  const mutation = useMutation({
    mutationFn: (values: Values) =>
      register
        ? registerAccount(signUpSchema.parse(values))
        : recoverAccount({ email: values.email }),
  });
  const fields: ("name" | "email" | "password")[] = register
    ? ["name", "email", "password"]
    : ["email"];
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t(register ? "createAccount" : "resetPassword")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t(register ? "createAccountDescription" : "resetDescription")}
      </p>
      {mutation.isSuccess ? (
        <p role="status" className="mt-6 rounded-lg bg-accent p-4 text-sm">
          {t(
            env.demoMode
              ? "demoRequestSuccess"
              : register
                ? "registerSuccess"
                : "resetSuccess",
          )}
        </p>
      ) : (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="mt-8 space-y-5"
        >
          {fields.map((field) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>{t(field)}</Label>
              <Input
                id={field}
                type={
                  field === "password"
                    ? "password"
                    : field === "email"
                      ? "email"
                      : "text"
                }
                autoComplete={field === "password" ? "new-password" : field}
                aria-invalid={!!form.formState.errors[field]}
                aria-describedby={`${field}-error`}
                {...form.register(field)}
              />
              <p id={`${field}-error`} className="text-xs text-destructive">
                {form.formState.errors[field] &&
                  t(form.formState.errors[field]?.message ?? "invalid")}
              </p>
            </div>
          ))}
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("requestError")}
            </p>
          )}
          <Button
            className="w-full"
            type="submit"
            disabled={mutation.isPending}
          >
            {t(
              mutation.isPending
                ? "saving"
                : register
                  ? "createAccount"
                  : "sendReset",
            )}
          </Button>
        </form>
      )}
      <Link
        href="/auth/sign-in"
        className="mt-7 block text-center text-sm font-medium text-primary hover:underline"
      >
        {t("backToSignIn")}
      </Link>
    </div>
  );
}
