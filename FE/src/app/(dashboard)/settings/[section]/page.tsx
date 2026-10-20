import { notFound } from "next/navigation";
import { AuthorizationSettings } from "@/features/authorization/components/authorization-settings";
import type { SettingsSection } from "@/features/authorization/components/authorization-settings";
export default async function ScopedSettingsPage({params}:{params:Promise<{section:string}>}){
  const {section}=await params;
  if(!["roles","users","tenants","operations","migrations"].includes(section))notFound();
  return <AuthorizationSettings section={section as SettingsSection}/>;
}
