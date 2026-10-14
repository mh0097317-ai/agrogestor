"use client";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { weeklyPeriod } from "@/lib/weekly-report";
import "./weekly-reports.css";

export function WeeklyReports({
  professionals = [],
  ownProfessionalId,
  canSchedule = false,
  platform = false,
}: {
  professionals?: { id: string; name: string }[];
  ownProfessionalId?: string;
  canSchedule?: boolean;
  platform?: boolean;
}) {
  const [week, setWeek] = useState(() => weeklyPeriod().from);
  const [professional, setProfessional] = useState(ownProfessionalId || "");
  const [prefs, setPrefs] = useState<{
    enabled: boolean;
    includeProfessionals: boolean;
    ownerPhone: string;
    emailEnabled?: boolean;
  }>({
    enabled: false,
    includeProfessionals: true,
    ownerPhone: "",
  });
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const base = platform
    ? "/api/admin/reports/weekly"
    : "/api/workspace/reports/weekly";
  useEffect(() => {
    if (!canSchedule) return;
    let stopped = false;
    fetch(`${base}/settings`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok)
          throw Error(data.error || "Não foi possível carregar os envios.");
        if (!stopped) {
          setPrefs(data);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, [base, canSchedule]);
  async function download() {
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ week });
      if (professional) query.set("professionalId", professional);
      const r = await fetch(`${base}?${query}`, { cache: "no-store" });
      if (!r.ok) {
        const e = await r.json();
        throw Error(e.error || "Não foi possível gerar o PDF.");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `studioflow-semanal-${platform ? "plataforma" : professional ? "profissional" : "dono"}-${week}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage("PDF gerado. Confira os downloads do seu aparelho.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar PDF.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`${base}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          platform
            ? { enabled: prefs.enabled, includeProfessionals: prefs.includeProfessionals, ownerPhone: prefs.ownerPhone }
            : { ...prefs, emailEnabled: prefs.emailEnabled !== false },
        ),
      });
      const value = await r.json();
      if (!r.ok) throw Error(value.error || "Não foi possível salvar.");
      setPrefs(value);
      setMessage(
        value.enabled
          ? "Envio semanal ativado: segunda-feira às 9h, horário de Brasília."
          : "Envio automático pausado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="weekly-report-card">
      <div className="weekly-report-heading">
        <span>STUDIOFLOW / SEMANA EM FOCO</span>
        <h2>
          {platform
            ? "Sua plataforma, em PDF"
            : "Seu relatório semanal, em PDF"}
        </h2>
        <p>
          {platform
            ? "Recebimentos das assinaturas e situação dos estabelecimentos."
            : "Resultados reais, gráfico da semana e detalhes do atendimento. Uma versão para a loja e outra para cada profissional."}
        </p>
      </div>
      <div className="weekly-report-controls">
        <label>
          Semana que começa em
          <input
            type="date"
            value={week}
            onChange={(e) => {
              if (e.target.value) setWeek(weeklyPeriod(e.target.value).from);
            }}
          />
        </label>
        {!platform && !ownProfessionalId && (
          <label>
            Versão do relatório
            <select
              value={professional}
              onChange={(e) => setProfessional(e.target.value)}
            >
              <option value="">Dono - resultado da loja</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - resultado individual
                </option>
              ))}
            </select>
          </label>
        )}
        <Button onClick={() => void download()} disabled={busy}>
          {busy ? "Preparando…" : "Baixar PDF"}
        </Button>
      </div>
      {canSchedule && (
        <details className="weekly-report-schedule">
          <summary>{platform ? "Receber no WhatsApp toda segunda às 9h" : "Receber no WhatsApp e no e-mail toda segunda às 9h"}</summary>
          <p>
            O PDF cobre a semana anterior, de segunda a domingo. Confira o
            destinatário antes de ativar.
          </p>
          <label>
            WhatsApp {platform ? "do dono da plataforma" : "do dono da loja"}
            <input
              type="tel"
              inputMode="tel"
              placeholder="DDD + número"
              value={prefs.ownerPhone}
              onChange={(e) =>
                setPrefs({ ...prefs, ownerPhone: e.target.value })
              }
            />
          </label>
          {!platform && (
            <label className="weekly-report-check">
              <input
                type="checkbox"
                checked={prefs.includeProfessionals}
                onChange={(e) =>
                  setPrefs({ ...prefs, includeProfessionals: e.target.checked })
                }
              />
              Enviar também o PDF individual de cada barbeiro para o número
              cadastrado no perfil
            </label>
          )}
          {!platform && (
            <label className="weekly-report-check">
              <input
                type="checkbox"
                checked={prefs.emailEnabled !== false}
                onChange={(e) =>
                  setPrefs({ ...prefs, emailEnabled: e.target.checked })
                }
              />
              Receber o PDF também no e-mail de login do dono
            </label>
          )}
          <label className="weekly-report-check">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) =>
                setPrefs({ ...prefs, enabled: e.target.checked })
              }
            />
            Ativar envio automático no WhatsApp para os números acima
          </label>
          <Button
            variant="secondary"
            onClick={() => void save()}
            disabled={!loaded || busy}
          >
            Salvar envio semanal
          </Button>
        </details>
      )}
      {error && (
        <p className="weekly-report-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </Card>
  );
}
