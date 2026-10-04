import type { Metadata } from "next";
import { TvMode } from "@/features/tv/tv-mode";

export const metadata: Metadata = {
  title: "Recepção",
  robots: { index: false, follow: false },
};

export default function TvPage() {
  return <TvMode />;
}
