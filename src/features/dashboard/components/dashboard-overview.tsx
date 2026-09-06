"use client";
import Link from "next/link";
import { ArrowUpRight, UsersRound, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/shared/can";
import { PERMISSIONS } from "@/config/permissions";
import { env } from "@/config/env";
import { useSession } from "@/features/auth/hooks/use-session";
import { formatNumber } from "@/lib/utils/number";
export function DashboardOverview() {
  const t = useTranslations();
  const { data } = useSession();
  return (
    <>
      <PageHeader
        title={t("greeting", { name: data?.name.split(" ")[0] ?? "" })}
        description={t("dashboardDescription")}
      />
      <div className="mb-8 grid gap-5 sm:grid-cols-3">
        {[
          { label: "teamMembers", value: 9 },
          { label: "activeMembers", value: 7 },
          { label: "pendingInvites", value: 2 },
        ].map((item) => (
          <Card key={item.label} className="shadow-none">
            <CardHeader>
              <CardDescription>{t(item.label)}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {env.demoMode ? formatNumber(item.value) : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {t(env.demoMode ? "sampleMetric" : "connectMetric")}
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="rounded-xl border bg-card p-6 md:p-8">
        <h2 className="text-xl font-semibold">{t("workspaceOverview")}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("workspaceOverviewDescription")}
        </p>
        <div className="mt-7 divide-y">
          <Can permission={PERMISSIONS.USER.READ}>
            <Link href="/users" className="group flex items-center gap-4 py-5">
              <UsersRound className="size-5 text-primary" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold group-hover:underline">
                  {t("manageTeam")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("manageTeamDescription")}
                </p>
              </div>
              <ArrowUpRight className="size-5 text-muted-foreground" />
            </Link>
          </Can>
          <Can permission={PERMISSIONS.SETTINGS.READ}>
            <Link
              href="/settings"
              className="group flex items-center gap-4 py-5"
            >
              <Settings2 className="size-5 text-primary" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold group-hover:underline">
                  {t("personalizeWorkspace")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("personalizeDescription")}
                </p>
              </div>
              <ArrowUpRight className="size-5 text-muted-foreground" />
            </Link>
          </Can>
        </div>
      </section>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>{t(env.demoMode ? "demoBanner" : "readyBanner")}</p>
        <Can permission={PERMISSIONS.USER.READ}>
          <Button variant="outline" asChild>
            <Link href="/users">
              {t("viewUsers")}
              <ArrowUpRight />
            </Link>
          </Button>
        </Can>
      </div>
    </>
  );
}
