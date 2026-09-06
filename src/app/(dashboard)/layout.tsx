import { AuthGuard } from "@/features/auth/components/auth-guard";
import { AppShell } from "@/components/shared/layout/app-shell";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
