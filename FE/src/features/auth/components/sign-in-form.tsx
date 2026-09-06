"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, LoaderCircle } from "lucide-react";
import {
  signInSchema,
  type SignInValues,
} from "@/features/auth/schemas/auth.schema";
import { signIn } from "@/features/auth/api/sign-in";
import { AUTH_QUERY_KEY } from "@/features/auth/constants";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { token } from "@/lib/auth/token";
import { env } from "@/config/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
export function SignInForm() {
  const t = useTranslations();
  const router = useRouter();
  const client = useQueryClient();
  const expired = useAuthStore((state) => state.expired);
  const setExpired = useAuthStore((state) => state.setExpired);
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", remember: false },
  });
  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: async (data) => {
      token.clear();
      await client.cancelQueries();
      client.clear();
      token.set(data.accessToken);
      client.setQueryData(AUTH_QUERY_KEY, data.user);
      setExpired(false);
      router.replace("/dashboard");
    },
  });
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("welcomeBack")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t("signInDescription")}
      </p>
      {expired && (
        <p role="status" className="mt-4 text-sm text-destructive">
          {t("sessionExpired")}
        </p>
      )}
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="mt-8 space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!form.formState.errors.email}
            aria-describedby="email-error"
            {...form.register("email")}
          />
          <p id="email-error" className="text-xs text-destructive">
            {form.formState.errors.email &&
              t(form.formState.errors.email.message!)}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password}
            aria-describedby="password-error"
            {...form.register("password")}
          />
          <p id="password-error" className="text-xs text-destructive">
            {form.formState.errors.password &&
              t(form.formState.errors.password.message!)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  id="remember"
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
              )}
            />
            <Label htmlFor="remember">{t("remember")}</Label>
          </div>
          <Link
            href="/auth/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("signInError")}
          </p>
        )}
        <Button
          className="w-full"
          size="lg"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : null}
          {t(mutation.isPending ? "signingIn" : "signIn")}
          <ArrowRight />
        </Button>
      </form>
      {env.demoMode && (
        <div className="mt-6 rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-medium">{t("demoAccess")}</p>
          <p className="mt-1 break-all text-muted-foreground">
            admin@example.com / Password123!
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("demoMemory")}
          </p>
        </div>
      )}
      <p className="mt-7 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/auth/sign-up"
          className="font-medium text-primary hover:underline"
        >
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
