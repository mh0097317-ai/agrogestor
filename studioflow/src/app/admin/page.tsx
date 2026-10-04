import type { Metadata } from "next";
import { PlatformAdmin } from "@/features/platform/platform-admin";

export const metadata: Metadata = {
  title: "Plataforma",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <PlatformAdmin />;
}
