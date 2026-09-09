import { AccountForm } from "@/features/auth/components/account-form";
import { AuthScene } from "@/features/auth/components/auth-scene";
export const metadata = { title: "Reset password" };
export default function ForgotPasswordPage() {
  return (
    <AuthScene>
      <AccountForm mode="recover" />
    </AuthScene>
  );
}
