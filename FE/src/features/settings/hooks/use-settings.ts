"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings } from "@/features/settings/api/get-settings";
import { updateSettings } from "@/features/settings/api/update-settings";
const SETTINGS_KEY = ["settings"] as const;
export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: getSettings });
}
export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => client.setQueryData(SETTINGS_KEY, data),
  });
}
