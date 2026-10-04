import { Suspense } from "react";
import { BookingFlow } from "@/features/booking/booking-flow";
import { BookingLoader } from "@/features/booking/booking-intro";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense fallback={<BookingLoader />}>
      <BookingFlow slug={slug} />
    </Suspense>
  );
}
