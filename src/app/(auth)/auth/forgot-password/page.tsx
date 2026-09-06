import { AccountForm } from "@/features/auth/components/account-form";
export const metadata = { title: "Reset password" };
export default function ForgotPasswordPage() {
  return <AccountForm mode="recover" />;
}
