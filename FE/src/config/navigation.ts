import {
  ArrowLeftRight,
  Bot,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  PackageMinus,
  PackagePlus,
  PackageSearch,
  Scale,
  ScanText,
  Settings2,
  ShieldCheck,
  Tags,
  Trash2,
  Truck,
  Users,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/config/permissions";

export type NavGroupId =
  | "overview"
  | "operations"
  | "masterData"
  | "reports"
  | "system"
  | "ai";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  /** When false, item is visible but not a live route yet. */
  ready?: boolean;
}

export interface NavigationGroup {
  id: NavGroupId;
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    label: "Tổng quan",
    items: [
      {
        id: "dashboard",
        label: "Tổng quan kho",
        href: "/dashboard",
        icon: LayoutDashboard,
        ready: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Vận hành",
    items: [
      {
        id: "inbound",
        label: "Nhập kho",
        href: "/operations/inbound",
        icon: PackagePlus,
      },
      {
        id: "outbound",
        label: "Xuất kho",
        href: "/operations/outbound",
        icon: PackageMinus,
      },
      {
        id: "stock",
        label: "Tồn kho",
        href: "/operations/stock",
        icon: Boxes,
      },
      {
        id: "inventory-check",
        label: "Kiểm kê",
        href: "/operations/inventory-check",
        icon: ClipboardCheck,
      },
      {
        id: "transfer",
        label: "Điều chuyển",
        href: "/operations/transfer",
        icon: ArrowLeftRight,
      },
      {
        id: "disposal",
        label: "Thanh lý / Hủy",
        href: "/operations/disposal",
        icon: Trash2,
      },
    ],
  },
  {
    id: "masterData",
    label: "Danh mục",
    items: [
      {
        id: "materials",
        label: "Vật liệu",
        href: "/master/materials",
        icon: PackageSearch,
      },
      {
        id: "material-types",
        label: "Loại vật liệu",
        href: "/master/material-types",
        icon: Tags,
      },
      {
        id: "locations",
        label: "Kho & vị trí",
        href: "/master/locations",
        icon: Warehouse,
        ready: true,
      },
      {
        id: "suppliers",
        label: "Nhà cung cấp",
        href: "/master/suppliers",
        icon: Truck,
      },
      {
        id: "units",
        label: "Đơn vị tính",
        href: "/master/units",
        icon: Scale,
      },
      {
        id: "departments",
        label: "Phòng ban",
        href: "/master/departments",
        icon: Building2,
      },
      {
        id: "employees",
        label: "Nhân viên",
        href: "/master/employees",
        icon: Users,
      },
    ],
  },
  {
    id: "reports",
    label: "Báo cáo",
    items: [
      {
        id: "report-inbound",
        label: "Báo cáo nhập kho",
        href: "/reports/inbound",
        icon: FileBarChart,
      },
      {
        id: "report-outbound",
        label: "Báo cáo xuất kho",
        href: "/reports/outbound",
        icon: FileBarChart,
      },
      {
        id: "report-stock",
        label: "Báo cáo tồn kho",
        href: "/reports/stock",
        icon: FileBarChart,
      },
      {
        id: "report-check",
        label: "Báo cáo kiểm kê",
        href: "/reports/inventory-check",
        icon: ClipboardCheck,
      },
      {
        id: "report-expiry",
        label: "Hạn sử dụng",
        href: "/reports/expiry",
        icon: ChartNoAxesCombined,
      },
      {
        id: "report-quarantine",
        label: "Hàng cách ly",
        href: "/reports/quarantine",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "system",
    label: "Hệ thống",
    items: [
      {
        id: "users",
        label: "Người dùng",
        href: "/users",
        icon: UsersRound,
        permission: PERMISSIONS.USER.READ,
        ready: true,
      },
      {
        id: "roles",
        label: "Phân quyền",
        href: "/system/roles",
        icon: ShieldCheck,
      },
      {
        id: "audit",
        label: "Nhật ký hoạt động",
        href: "/system/audit",
        icon: ClipboardCheck,
      },
      {
        id: "settings",
        label: "Cấu hình",
        href: "/settings",
        icon: Settings2,
        permission: PERMISSIONS.SETTINGS.READ,
        ready: true,
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      {
        id: "ai-assistant",
        label: "Trợ lý kho",
        href: "/ai/assistant",
        icon: Bot,
      },
      {
        id: "ai-ocr",
        label: "OCR hóa đơn",
        href: "/ai/ocr",
        icon: ScanText,
      },
      {
        id: "ai-forecast",
        label: "Dự báo nhu cầu",
        href: "/ai/forecast",
        icon: ChartNoAxesCombined,
      },
      {
        id: "ai-health",
        label: "Sức khỏe tồn kho",
        href: "/ai/stock-health",
        icon: Boxes,
      },
      {
        id: "ai-risk",
        label: "Rủi ro hạn dùng",
        href: "/ai/expiry-risk",
        icon: ShieldCheck,
      },
    ],
  },
];

/** Flat list for breadcrumbs / page title lookup. */
export const navigation = navigationGroups.flatMap((group) => group.items);

export function findNavigationItem(pathname: string) {
  return navigation.find(
    (item) => item.href === pathname || pathname.startsWith(`${item.href}/`),
  );
}
