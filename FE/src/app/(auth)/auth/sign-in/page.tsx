import { SignInForm } from "@/features/auth/components/sign-in-form";
import { AuthScene } from "@/features/auth/components/auth-scene";
export const metadata = { title: "Đăng nhập" };
export default function SignInPage() {
  return (
    <AuthScene>
      <SignInForm />
    </AuthScene>
  );
}
