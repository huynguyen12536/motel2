"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  userSchema,
  type UserValues,
} from "@/features/users/schemas/user.schema";
import type { User } from "@/features/users/types/user.type";
import { normalizeApiError } from "@/lib/api/api-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function UserForm({
  user,
  onSave,
  onCancel,
  pending,
}: {
  user?: User;
  onSave: (values: UserValues) => Promise<unknown>;
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations();
  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "viewer",
    },
  });
  const submit = async (values: UserValues) => {
    try {
      await onSave(values);
    } catch (error) {
      const normalized = normalizeApiError(error);
      for (const field of ["name", "email", "role"] as const)
        if (normalized.errors?.[field])
          form.setError(field, { message: "invalid" });
      form.setError("root", {
        message: normalized.code === "CONFLICT" ? "emailConflict" : "saveError",
      });
    }
  };
  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-5">
      {(["name", "email"] as const).map((field) => (
        <div className="space-y-2" key={field}>
          <Label htmlFor={`user-${field}`}>{t(field)}</Label>
          <Input
            id={`user-${field}`}
            type={field === "email" ? "email" : "text"}
            autoComplete={field}
            {...form.register(field)}
            aria-invalid={!!form.formState.errors[field]}
            aria-describedby={`user-${field}-error`}
          />
          <p className="text-xs text-destructive" id={`user-${field}-error`}>
            {form.formState.errors[field] &&
              t(form.formState.errors[field]?.message ?? "invalid")}
          </p>
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor="user-role">{t("role")}</Label>
        <Controller
          name="role"
          control={form.control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["admin", "editor", "viewer"] as const).map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {t(form.formState.errors.root.message!)}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t(pending ? "saving" : "saveUser")}
        </Button>
      </div>
    </form>
  );
}
