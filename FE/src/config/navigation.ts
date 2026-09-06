import {
  LayoutDashboard,
  UsersRound,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/config/permissions";
export interface NavigationItem {
  title: "dashboard" | "users" | "settings";
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  children?: NavigationItem[];
}
export const navigation: NavigationItem[] = [
  { title: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "users",
    href: "/users",
    icon: UsersRound,
    permission: PERMISSIONS.USER.READ,
  },
  {
    title: "settings",
    href: "/settings",
    icon: Settings2,
    permission: PERMISSIONS.SETTINGS.READ,
  },
];
