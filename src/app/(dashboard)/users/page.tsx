import { UserList } from "@/features/users/components/user-list";
import { Can } from "@/components/shared/can";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { PERMISSIONS } from "@/config/permissions";
export const metadata = { title: "Users" };
export default function UsersPage() {
  return (
    <Can permission={PERMISSIONS.USER.READ} fallback={<PermissionDenied />}>
      <UserList />
    </Can>
  );
}
