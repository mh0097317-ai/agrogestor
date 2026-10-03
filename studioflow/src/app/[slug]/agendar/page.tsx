import { Suspense } from "react";
import { BookingFlow } from "@/features/booking/booking-flow";
import { PublicLoading } from "@/features/public/public-ui";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense fallback={<PublicLoading />}>
      <BookingFlow slug={slug} />
    </Suspense>
  );
}
