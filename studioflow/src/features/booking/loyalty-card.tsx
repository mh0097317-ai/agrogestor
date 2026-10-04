"use client";

import { Check, Gift } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import { loyaltyProgress } from "@/lib/loyalty";

/** Stamp card shown to the customer on the receipt. */
export function LoyaltyCard({
  visits,
  goal,
  reward,
}: {
  visits: number;
  goal: number;
  reward: string;
}) {
  const progress = loyaltyProgress(visits, goal);
  return (
    <section
      className={`bk-loyalty ${progress.rewardReady ? "is-ready" : ""}`}
      aria-label="Cartão fidelidade"
    >
      <header>
        <span className="bk-loyalty-icon" aria-hidden="true">
          <Gift weight="duotone" size={20} />
        </span>
        <div>
          <strong>Cartão fidelidade</strong>
          <span>
            {progress.rewardReady
              ? `Cartão completo! Seu próximo atendimento ganha: ${reward}.`
              : progress.stamps === 0
                ? `A cada ${progress.goal} atendimentos você ganha: ${reward}.`
                : `Faltam ${progress.missing} ${progress.missing === 1 ? "atendimento" : "atendimentos"} para ganhar: ${reward}.`}
          </span>
        </div>
        <b>
          {progress.stamps}/{progress.goal}
        </b>
      </header>
      <ol
        className="bk-stamps"
        style={{ "--cols": Math.min(progress.goal, 10) } as CSSProperties}
        aria-label={`${progress.stamps} de ${progress.goal} carimbos`}
      >
        {Array.from({ length: progress.goal }, (_, index) => (
          <li
            key={index}
            className={index < progress.stamps ? "is-on" : ""}
            style={{ "--i": index } as CSSProperties}
          >
            {index === progress.goal - 1 ? (
              <Gift
                weight={index < progress.stamps ? "fill" : "regular"}
                size={14}
              />
            ) : index < progress.stamps ? (
              <Check weight="bold" size={14} />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
