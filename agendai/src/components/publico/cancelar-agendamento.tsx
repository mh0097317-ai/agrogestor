"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { cancelar } from "@/app/agendamento/[token]/actions";
import { AreaTexto, Botao } from "@/components/ui";

export function CancelarAgendamento({ token }: { token: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="w-full py-2 text-sm font-semibold text-suave hover:text-erro">
        Não vou conseguir ir — cancelar horário
      </button>
    );
  }

  return (
    <div className="animate-surgir rounded-2xl border border-erro/20 bg-erro-bg/50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-ink">Cancelar este horário?</p>
        <button onClick={() => setAberto(false)} className="text-suave hover:text-ink" aria-label="Fechar">
          <X className="size-4" />
        </button>
      </div>
      <AreaTexto
        rows={2}
        placeholder="Quer contar o motivo? (opcional)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="bg-papel"
      />
      {erro && <p className="mt-2 text-sm font-medium text-erro">{erro}</p>}
      <Botao
        variante="perigo"
        className="mt-3 w-full"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await cancelar(token, motivo);
            if (r.erro) setErro(r.erro);
          })
        }
      >
        {pendente && <Loader2 className="size-4 animate-spin" />}
        Sim, cancelar
      </Botao>
    </div>
  );
}
