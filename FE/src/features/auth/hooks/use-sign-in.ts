"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  signInSchema,
  type SignInValues,
} from "@/features/auth/schemas/auth.schema";
import { signIn } from "@/features/auth/api/sign-in";
import { AUTH_QUERY_KEY } from "@/features/auth/constants";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { MOCK_CREDENTIALS } from "@/features/auth/mocks/mock-auth";
import { env } from "@/config/env";
import { token } from "@/lib/auth/token";

const DEMO_DEFAULTS: SignInValues = {
  email: MOCK_CREDENTIALS.email,
  password: MOCK_CREDENTIALS.password,
  remember: false,
};

export function useSignIn() {
  const router = useRouter();
  const client = useQueryClient();
  const expired = useAuthStore((state) => state.expired);
  const setExpired = useAuthStore((state) => state.setExpired);
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: env.demoMode
      ? DEMO_DEFAULTS
      : { email: "", password: "", remember: false },
  });

  useEffect(() => {
    // Re-apply demo creds after mount — password managers often clear type=password.
    if (!env.demoMode) return;
    form.reset(DEMO_DEFAULTS);
  }, [form]);

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
  return { form, mutation, expired };
}
