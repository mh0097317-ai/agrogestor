import type { Metadata } from "next";
import { Pricing } from "@/features/landing/pricing";
import { publicPlans } from "@/services/platform-plans";
import { trialDays } from "@/services/platform-trial";

export const metadata: Metadata = {
  title: { absolute: "Planos e preços · StudioFlow" },
  description:
    "Planos do StudioFlow para barbearias: agenda online, página da casa, lembretes no WhatsApp e recepcionista com IA. Sem comissão por cliente.",
};
export const revalidate = 300;

export default async function PricingPage() {
  const [plans, trial] = await Promise.all([
    publicPlans(),
    trialDays().catch(() => 30),
  ]);
  return <Pricing plans={plans} trialDays={trial} />;
}
