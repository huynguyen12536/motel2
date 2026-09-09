"use client";
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
import { token } from "@/lib/auth/token";

export function useSignIn() {
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
  return { form, mutation, expired };
}
