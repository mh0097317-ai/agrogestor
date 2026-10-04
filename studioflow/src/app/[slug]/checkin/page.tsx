import type { Metadata } from "next";
import { CheckInPage } from "@/features/public/checkin-page";

export const metadata: Metadata = {
  title: "Check-in",
  robots: { index: false, follow: false },
};

export default async function CheckInRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CheckInPage slug={slug} />;
}
