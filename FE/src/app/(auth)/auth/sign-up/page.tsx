import { AccountForm } from "@/features/auth/components/account-form";
export const metadata = { title: "Create account" };
export default function SignUpPage() {
  return <AccountForm mode="register" />;
}
