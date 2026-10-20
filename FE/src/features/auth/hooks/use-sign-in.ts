"use client";
import { useEffect, useRef } from "react";
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
  "use no memo"; // React Hook Form exposes mutable registration/state; do not cache its render bindings.
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

  const demoInitialized = useRef(false);
  useEffect(() => {
    // Re-apply demo creds once after mount — password managers often clear type=password.
    if (!env.demoMode || demoInitialized.current) return;
    demoInitialized.current = true;
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
      router.replace(env.demoMode ? "/dashboard" : "/settings");
    },
  });
  return { form, mutation, expired };
}
