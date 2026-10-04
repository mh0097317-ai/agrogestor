import { DoorOpen } from "@phosphor-icons/react/dist/ssr";
import { dateLabel } from "@/lib/utils";
import type { Appointment } from "@/types";

/** "Chegou 14:52": o cliente fez check-in e ainda não foi atendido. */
export function ArrivedTag({
  appointment,
  compact = false,
}: {
  appointment: Appointment;
  compact?: boolean;
}) {
  if (!appointment.checkedInAt || !["pending", "confirmed"].includes(appointment.status))
    return null;
  return (
    <span className="arrived-tag" title="O cliente avisou pelo QR Code da recepção">
      <DoorOpen size={13} weight="fill" />
      {compact ? "Chegou" : `Chegou ${dateLabel(appointment.checkedInAt, "HH:mm")}`}
    </span>
  );
}
