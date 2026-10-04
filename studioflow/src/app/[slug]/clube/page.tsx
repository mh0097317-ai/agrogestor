import type { Metadata } from "next";
import { Suspense } from "react";
import { ClubPage } from "@/features/public/club-page";
import { BookingLoader } from "@/features/booking/booking-intro";

export const metadata: Metadata = {
  title: "Clube de assinatura · Studioflow",
  robots: { index: false, follow: false },
};

export default async function ClubRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense fallback={<BookingLoader />}>
      <ClubPage slug={slug} />
    </Suspense>
  );
}
