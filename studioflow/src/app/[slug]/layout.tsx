import { HandoffLayer } from "@/features/booking/intro-handoff";

/** The opening that starts on the page and ends on the booking lives here. */
export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <HandoffLayer />
    </>
  );
}
