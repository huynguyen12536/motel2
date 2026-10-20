import { AuthScene } from "@/features/auth/components/auth-scene";
import { PlatformSignIn } from "@/features/authorization/components/platform-sign-in";
export const metadata={title:"Platform sign in"};
export default function PlatformSignInPage(){return <AuthScene><PlatformSignIn/></AuthScene>;}
