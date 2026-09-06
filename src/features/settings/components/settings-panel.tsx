"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { settingsSchema } from "@/features/settings/schemas/settings.schema";
import type { WorkspaceSettings } from "@/features/settings/types/settings.type";
import {
  useSettings,
  useUpdateSettings,
} from "@/features/settings/hooks/use-settings";
import { LOCALES } from "@/constants/app";
import { useUiStore } from "@/stores/ui.store";
import { usePermission } from "@/hooks/use-permission";
import { PERMISSIONS } from "@/config/permissions";
import { PageHeader } from "@/components/shared/page-header/page-header";
import { LoadingState } from "@/components/shared/loading/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
function WorkspaceForm({ settings }: { settings: WorkspaceSettings }) {
  const t = useTranslations();
  const can = usePermission();
  const mutation = useUpdateSettings();
  const form = useForm<WorkspaceSettings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        mutation.mutate(values, {
          onSuccess: () => toast.success(t("settingsSaved")),
          onError: () => toast.error(t("saveError")),
        }),
      )}
    >
      <Label htmlFor="workspace-name">{t("workspaceName")}</Label>
      <Input
        id="workspace-name"
        disabled={!can(PERMISSIONS.SETTINGS.UPDATE)}
        aria-invalid={!!form.formState.errors.workspaceName}
        aria-describedby="workspace-error"
        {...form.register("workspaceName")}
      />
      <p id="workspace-error" className="text-xs text-destructive">
        {form.formState.errors.workspaceName && t(form.formState.errors.workspaceName.message ?? "invalid")}
      </p>
      {can(PERMISSIONS.SETTINGS.UPDATE) && (
        <Button type="submit" disabled={mutation.isPending}>
          {t(mutation.isPending ? "saving" : "saveChanges")}
        </Button>
      )}
    </form>
  );
}
export function SettingsPanel() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const compact = useUiStore((state) => state.compact);
  const setCompact = useUiStore((state) => state.setCompact);
  const query = useSettings();
  return (
    <>
      <PageHeader
        title={t("settings")}
        description={t("settingsDescription")}
      />
      <div className="max-w-3xl divide-y rounded-xl border bg-card px-6 md:px-8">
        <section className="py-7">
          <h2 className="mb-5 text-lg font-semibold">{t("general")}</h2>
          {query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <div role="alert">
              <p className="mb-3 text-sm">{t("requestError")}</p>
              <Button variant="outline" onClick={() => query.refetch()}>
                {t("retry")}
              </Button>
            </div>
          ) : (
            <WorkspaceForm settings={query.data} />
          )}
        </section>
        <section className="space-y-6 py-7">
          <h2 className="text-lg font-semibold">{t("preferences")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label htmlFor="locale">{t("language")}</Label>
            <Select
              value={locale}
              onValueChange={(value) => {
                document.cookie = `locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
                router.refresh();
              }}
            >
              <SelectTrigger id="locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {
                      {
                        en: "English",
                        fr: "Français",
                        de: "Deutsch",
                        vi: "Tiếng Việt",
                      }[item]
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label htmlFor="theme">{t("appearance")}</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme" className="w-full">
                <SelectValue placeholder={t("light")} />
              </SelectTrigger>
              <SelectContent>
                {["light", "dark", "system"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="compact"
              checked={compact}
              onCheckedChange={(value) => setCompact(value === true)}
            />
            <Label htmlFor="compact">{t("compactTable")}</Label>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("preferencesNote")}
          </p>
        </section>
      </div>
    </>
  );
}
