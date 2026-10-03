"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Button, Card, EmptyState, MetricStrip } from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import "./management.css";

export function ManagementBoundary({ children }: { children: ReactNode }) {
  const { data, loading, error, refresh } = useWorkspace();
  if (loading)
    return (
      <div className="management-skeleton" aria-label="Carregando dados">
        <span />
        <span />
        <span />
      </div>
    );
  if (error)
    return (
      <Card className="management-error">
        <AlertCircle size={28} />
        <h2>Não foi possível carregar os dados</h2>
        <p>{error}</p>
        <Button onClick={() => void refresh()}>Tentar novamente</Button>
      </Card>
    );
  if (!data)
    return (
      <EmptyState
        title="Nenhum estabelecimento encontrado"
        description="Configure seu estabelecimento para começar."
      />
    );
  return <div className="management-page">{children}</div>;
}

export function SearchField({
  value,
  onChange,
  placeholder = "Buscar por nome...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="management-search">
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}

export function ManagementSummary({
  items,
}: {
  items: { label: string; value: string | number; detail: string }[];
}) {
  return <MetricStrip items={items} />;
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="management-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SubmitButton({
  busy,
  children = "Salvar alterações",
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <Button type="submit" disabled={busy}>
      {busy && <Loader2 size={16} className="management-spin" />}
      {busy ? "Salvando..." : children}
    </Button>
  );
}

export function FormError({ error }: { error: string }) {
  return error ? (
    <div className="management-form-error" role="alert">
      <AlertCircle size={16} />
      {error}
    </div>
  ) : null;
}

export function useFormAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}

export function WhatsAppLink({
  phone,
  message,
  children,
}: {
  phone: string;
  message?: string;
  children: ReactNode;
}) {
  const digits = phone.replace(/\D/g, "");
  const number =
    digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return (
    <a
      className="management-link-button"
      href={`https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export function brazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const ddds = new Set([
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "21",
    "22",
    "24",
    "27",
    "28",
    "31",
    "32",
    "33",
    "34",
    "35",
    "37",
    "38",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "51",
    "53",
    "54",
    "55",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "67",
    "68",
    "69",
    "71",
    "73",
    "74",
    "75",
    "77",
    "79",
    "81",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
    "89",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ]);
  return (
    ddds.has(digits.slice(0, 2)) &&
    (/^\d{2}9\d{8}$/.test(digits) || /^\d{2}[2-5]\d{7}$/.test(digits))
  );
}

export function downloadCsv(rows: string[][], filename: string) {
  const escape = (value: string) => {
    const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function DayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  return (
    <div className="management-day-picker">
      {dayNames.map((day, index) => (
        <button
          key={day}
          type="button"
          aria-pressed={value.includes(index)}
          className={value.includes(index) ? "selected" : ""}
          onClick={() =>
            onChange(
              value.includes(index)
                ? value.filter((item) => item !== index)
                : [...value, index].sort(),
            )
          }
        >
          {day}
        </button>
      ))}
    </div>
  );
}
