"use client";

import { useState } from "react";
import { DoorOpen } from "@phosphor-icons/react/dist/ssr";
import { DrawCheck } from "@/features/booking/draw-check";
import { bookingTime } from "@/features/booking/date-format";
import { haptic } from "@/lib/haptic";
import { publicRequest } from "./use-public-catalog";
import "./checkin.css";

/**
 * "Cheguei": no dia do atendimento, perto do horário, avisa a equipe. Usado
 * no comprovante e na página de check-in.
 */
export function CheckInButton({
  slug,
  token,
  checkedInAt,
  professional,
}: {
  slug: string;
  token: string;
  checkedInAt?: string | null;
  professional?: string;
}) {
  const [arrived, setArrived] = useState(checkedInAt || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true);
    setError("");
    try {
      const result = await publicRequest<{ checkedInAt: string }>(
        `/api/public/${encodeURIComponent(slug)}/checkin`,
        { method: "POST", body: JSON.stringify({ token }) },
      );
      haptic();
      setArrived(result.checkedInAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível avisar.");
    } finally {
      setBusy(false);
    }
  }

  if (arrived)
    return (
      <div className="ci-done" role="status">
        <span className="ci-done-mark">
          <DrawCheck size={22} />
        </span>
        <span>
          <strong>Chegada avisada às {bookingTime(arrived)}</strong>
          <small>
            {professional ? `${professional.split(" ")[0]} já sabe` : "A equipe já sabe"} que
            você está aqui.
          </small>
        </span>
      </div>
    );
  return (
    <div className="ci-box">
      <button type="button" className="ci-button" onClick={() => void send()} disabled={busy}>
        <DoorOpen size={20} weight="duotone" />
        {busy ? "Avisando…" : "Cheguei, avisar a equipe"}
      </button>
      {error && (
        <p className="ci-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
