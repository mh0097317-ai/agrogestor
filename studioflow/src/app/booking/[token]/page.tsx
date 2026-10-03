import type { Metadata } from "next";
import { BookingConfirmation } from "@/features/booking/booking-confirmation";

export const metadata: Metadata = {
  title: "Seu agendamento · Studioflow",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BookingConfirmation token={token} />;
}
