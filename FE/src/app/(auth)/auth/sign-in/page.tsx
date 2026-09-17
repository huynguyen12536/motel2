import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { AuthScene } from "@/features/auth/components/auth-scene";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("signIn") };
}

export default function SignInPage() {
  return (
    <AuthScene>
      <SignInForm />
    </AuthScene>
  );
}
