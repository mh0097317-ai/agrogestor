import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AdminLogin } from "@/features/platform/admin-login";
import { requirePlatformAdmin } from "@/services/platform";
import { isDemo } from "@/services/server-demo";

export const metadata: Metadata = {
  title: "Acesso administrativo",
  robots: { index: false, follow: false },
};
export default async function AdminLoginPage() {
  await connection();
  let authorized = false;
  if (!isDemo()) {
    try {
      await requirePlatformAdmin();
      authorized = true;
    } catch {
      /* Show the login. */
    }
  }
  if (authorized) redirect("/admin");
  return <AdminLogin demo={isDemo()} />;
}
