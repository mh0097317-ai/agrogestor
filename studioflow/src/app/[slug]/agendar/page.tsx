import { Suspense } from "react";
import { BookingFlow } from "@/features/booking/booking-flow";
import { BookingLoader } from "@/features/booking/booking-intro";
import { publicCatalog } from "@/services/public-catalog";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The opening shows the business right away instead of a loading line.
  const catalog = await publicCatalog(slug).catch(() => null);
  return (
    <Suspense fallback={<BookingLoader />}>
      <BookingFlow slug={slug} initialCatalog={catalog} />
    </Suspense>
  );
}
