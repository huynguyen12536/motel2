"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser } from "@/features/users/api/create-user";
import { updateUser } from "@/features/users/api/update-user";
import { deleteUser } from "@/features/users/api/delete-user";
import { USER_QUERY_KEYS } from "@/features/users/constants";
import type { UserValues } from "@/features/users/schemas/user.schema";
export function useUserMutations() {
  const client = useQueryClient();
  const invalidate = () =>
    client.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
  return {
    create: useMutation({ mutationFn: createUser, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: string; values: UserValues }) =>
        updateUser(id, values),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteUser, onSuccess: invalidate }),
  };
}
