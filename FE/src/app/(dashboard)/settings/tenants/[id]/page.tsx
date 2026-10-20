import { notFound } from "next/navigation";
import { AuthorizationSettings } from "@/features/authorization/components/authorization-settings";
export default async function TenantSettingsPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  return <AuthorizationSettings section="tenants" tenantId={id}/>;
}
