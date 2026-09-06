export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}
export interface AuthResponse {
  accessToken: string;
  user: CurrentUser;
}
