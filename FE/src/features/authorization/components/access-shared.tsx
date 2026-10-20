"use client";
import type { ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { normalizeApiError } from "@/lib/api/api-error";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading/loading-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AUTH_QUERY_KEY } from "@/features/auth/constants";
export function useAccessAction() {
  const client = useQueryClient(),
    t = useTranslations("access");
  return useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      toast.success(t("saved"));
      await client.invalidateQueries({ queryKey: ["access"] });
      await client.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}
export function QueryState({
  pending,
  error,
  retry,
  children,
}: {
  pending: boolean;
  error: unknown;
  retry: () => unknown;
  children: ReactNode;
}) {
  if (pending) return <LoadingState />;
  if (error) return <AccessError error={error} retry={retry} />;
  return children;
}
export function AccessError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => unknown;
}) {
  const t = useTranslations("access"),
    status = normalizeApiError(error).status;
  const key =
    status === 401
      ? "unauthenticated"
      : status === 403
        ? "forbidden"
        : status === 404
          ? "notFound"
          : status === 409
            ? "conflict"
            : status === 400
              ? "invalid"
              : "unavailable";
  return (
    <div role="alert" className="access-feedback">
      <p>{t(key)}</p>
      {retry && (
        <Button variant="outline" onClick={() => retry()}>
          {t("refresh")}
        </Button>
      )}
    </div>
  );
}
export function AccessDialog({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function ConfirmAction({
  title,
  onConfirm,
  pending,
  onClose,
  error,
}: {
  title: string;
  onConfirm: () => void;
  pending: boolean;
  onClose: () => void;
  error?: unknown;
}) {
  const t = useTranslations("access");
  return (
    <AccessDialog
      title={title}
      description={t("confirmHint")}
      open
      onClose={onClose}
    >
      {Boolean(error) && <AccessError error={error} />}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          {t(pending ? "saving" : "confirm")}
        </Button>
      </DialogFooter>
    </AccessDialog>
  );
}
