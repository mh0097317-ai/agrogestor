import type { Metadata } from "next";
import { AttendancePage } from "@/features/attendance/attendance-page";

export const metadata: Metadata = {
  title: "Atendimento · StudioFlow",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AttendancePage token={token} />;
}
