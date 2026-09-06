import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { Can } from "@/components/shared/can";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { PERMISSIONS } from "@/config/permissions";
export const metadata = { title: "Settings" };
export default function SettingsPage() {
  return (
    <Can permission={PERMISSIONS.SETTINGS.READ} fallback={<PermissionDenied />}>
      <SettingsPanel />
    </Can>
  );
}
