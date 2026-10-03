"use client";
import { CalendarDays } from "lucide-react";
import { dateLabel } from "@/lib/utils";
import {
  periodFor,
  type FinancePeriod,
  type FinancePreset,
} from "./finance-helpers";
const choices: { id: FinancePreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "7 dias" },
  { id: "month", label: "Este mês" },
  { id: "all", label: "Tudo" },
];
export function PeriodControl({
  period,
  preset,
  onChange,
}: {
  period: FinancePeriod;
  preset: FinancePreset;
  onChange: (period: FinancePeriod, preset: FinancePreset) => void;
}) {
  return (
    <div className="management-period">
      <div className="management-filters" aria-label="Período">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            aria-pressed={preset === choice.id}
            className={preset === choice.id ? "selected" : ""}
            onClick={() => onChange(periodFor(choice.id), choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <div className="management-period-dates">
        <CalendarDays size={16} />
        <label>
          <span className="sr-only">Data inicial</span>
          <input
            aria-label="Data inicial"
            type="date"
            value={preset === "all" ? "" : period.from}
            max={preset === "all" ? undefined : period.to}
            onChange={(event) =>
              onChange(
                {
                  ...periodFor("today"),
                  ...period,
                  from: event.target.value,
                  to: preset === "all" ? periodFor("today").to : period.to,
                },
                "custom",
              )
            }
          />
        </label>
        <span>até</span>
        <label>
          <span className="sr-only">Data final</span>
          <input
            aria-label="Data final"
            type="date"
            value={preset === "all" ? "" : period.to}
            min={preset === "all" ? undefined : period.from}
            onChange={(event) =>
              onChange(
                {
                  ...periodFor("today"),
                  ...period,
                  to: event.target.value,
                  from:
                    preset === "all" ? periodFor("month").from : period.from,
                },
                "custom",
              )
            }
          />
        </label>
      </div>
      <p className="management-period-caption">
        {preset === "all"
          ? "Todo o histórico registrado"
          : period.from && period.to
            ? `${dateLabel(period.from, "dd MMM")} – ${dateLabel(period.to, "dd MMM yyyy")}`
            : "Selecione as duas datas"}
      </p>
    </div>
  );
}
