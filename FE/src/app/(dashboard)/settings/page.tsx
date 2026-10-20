import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { Can } from "@/components/shared/can";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { PERMISSIONS } from "@/config/permissions";
import { env } from "@/config/env";
import { AuthorizationSettings } from "@/features/authorization/components/authorization-settings";
export const metadata = { title: "Settings" };
export default function SettingsPage() {
  if(!env.demoMode)return <AuthorizationSettings/>;
  return (
    <Can permission={PERMISSIONS.SETTINGS.READ} fallback={<PermissionDenied />}>
      <SettingsPanel />
    </Can>
  );
}
