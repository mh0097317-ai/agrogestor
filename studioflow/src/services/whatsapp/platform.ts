import { DomainError } from "@/lib/availability";
import { requirePlatformAdmin } from "../platform";
import { isDemo } from "../server-demo";
import {
  connectInstance,
  createInstance,
  evolutionReady,
  instanceOwner,
  instanceState,
  removeInstance,
  sendText,
} from "./evolution";
import { withCountry } from "./link";

/**
 * O WhatsApp do próprio StudioFlow (lembretes de mensalidade), ligado pela
 * equipe em /admin com QR Code. EVOLUTION_PLATFORM_INSTANCE muda o nome.
 */
const instance = () => process.env.EVOLUTION_PLATFORM_INSTANCE || "sf-studioflow";

export interface PlatformLink {
  ready: boolean;
  status: "connecting" | "open" | "close";
  phone: string;
  profileName: string;
  qr?: string;
  pairingCode?: string;
}

const off: PlatformLink = { ready: false, status: "close", phone: "", profileName: "" };

export async function platformLinkView(): Promise<PlatformLink> {
  await requirePlatformAdmin();
  if (isDemo() || !evolutionReady()) return off;
  const status = await instanceState(instance()).catch(() => "close" as const);
  const owner = status === "open" ? await instanceOwner(instance()).catch(() => null) : null;
  return { ready: true, status, phone: owner?.phone || "", profileName: owner?.name || "" };
}

export async function startPlatformLink(): Promise<PlatformLink> {
  await requirePlatformAdmin();
  if (isDemo() || !evolutionReady())
    throw new DomainError("Configure EVOLUTION_API_URL e EVOLUTION_API_KEY na Vercel primeiro.", 503);
  const state = await instanceState(instance()).catch(async (error) => {
    if (error instanceof DomainError && error.status === 404) {
      await createInstance(instance());
      return "close" as const;
    }
    throw error;
  });
  if (state === "open") return platformLinkView();
  const { qr, pairingCode } = await connectInstance(instance());
  return { ready: true, status: "connecting", phone: "", profileName: "", qr, pairingCode };
}

export async function unlinkPlatform() {
  await requirePlatformAdmin();
  if (!isDemo() && evolutionReady()) await removeInstance(instance());
  return { ok: true };
}

/** Sends from the StudioFlow number; false when it is not connected. */
export async function platformSend(to: string, body: string) {
  if (isDemo() || !evolutionReady()) return false;
  if ((await instanceState(instance()).catch(() => "close")) !== "open") return false;
  await sendText(instance(), withCountry(to), body);
  return true;
}
