export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  scope?:"platform"|"tenant";
  tenantId?:string|null;
  policyVersion?:number;
}
export interface AuthResponse {
  accessToken: string;
  user: CurrentUser;
}
