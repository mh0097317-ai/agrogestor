import { DomainError } from "@/lib/availability";
import { assertOnlineBookingEnabled } from "@/lib/online-booking";
import { requireMembership } from "@/lib/supabase/server";
import { isDemo, mutateDemo } from "./server-demo";
import { demoWorkspaceSlug, getPublicStore } from "./server-store";

/** Public-link queries only; the shared store and reservation engine stay channel-neutral. */
export async function getOnlineBookingStore(slug: string) {
  const store = await getPublicStore(slug);
  assertOnlineBookingEnabled(store.settings);
  return store;
}

export async function updateOnlineBooking(enabled: boolean) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        store.settings.onlineBookingEnabled = enabled;
        return { onlineBookingEnabled: enabled };
      },
      await demoWorkspaceSlug(),
    );

  const { client, businessId, role } = await requireMembership();
  if (!["owner", "admin", "manager"].includes(role))
    throw new DomainError(
      "Seu perfil não pode alterar o agendamento online.",
      403,
    );

  // The business comes from the session; existing admin_update RLS checks membership again.
  // A single-column update preserves all other settings and serializes with the public RPC.
  const { data, error } = await client
    .from("business_settings")
    .update({ online_booking_enabled: enabled })
    .eq("business_id", businessId)
    .select("online_booking_enabled")
    .single();
  if (error || !data)
    throw new DomainError("Não foi possível salvar o agendamento online.", 503);
  return { onlineBookingEnabled: data.online_booking_enabled as boolean };
}
