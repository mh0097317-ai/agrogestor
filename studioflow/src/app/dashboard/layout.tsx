import { DashboardLayout } from "@/features/dashboard/shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
