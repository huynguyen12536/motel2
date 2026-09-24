import type { Metadata } from "next";
import { KageScene } from "@/features/landing/components/kage-scene";

export const metadata: Metadata = {
  title: "WMS APA Nano — Mọi chuyển động đều được nhìn thấy",
  description:
    "Hệ thống quản lý kho cho APA Nano: tồn kho, luân chuyển, kiểm kê, chất lượng và phân quyền trong một nơi.",
};

export default function HomePage() {
  return <KageScene />;
}
