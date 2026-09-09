import { AccountForm } from "@/features/auth/components/account-form";
import { AuthScene } from "@/features/auth/components/auth-scene";
export const metadata = { title: "Create account" };
export default function SignUpPage() {
  return (
    <AuthScene>
      <AccountForm mode="register" />
    </AuthScene>
  );
}
