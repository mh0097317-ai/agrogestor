"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { InstagramIcon } from "@/components/brand-icons";
import { Button, FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Store } from "@/types";
import { FormError, FormField } from "./shared";

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}

/** Configurações → Estabelecimento: posts do Instagram dentro da página pública. */
export function InstagramFeedSettings({
  store,
  canManage,
  onSaved,
}: {
  store: Store;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const feed = store.instagramFeed;

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy(false);
    }
  }
  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const result = await send("/api/workspace/instagram-feed", "POST", { token });
      setToken("");
      toast(`Posts de @${result.username || ""} na sua página.`);
    });
  }

  return (
    <FormSection
      title="Posts do Instagram na página"
      description="Quando o cliente toca em Instagram na sua página, ele vê seu perfil, seus seguidores e os posts mais recentes sem sair do agendamento."
    >
      {feed ? (
        <div className="payment-account">
          <CheckCircle weight="fill" size={22} />
          <div>
            <strong>
              <InstagramIcon size={15} /> @{feed.username || "conta conectada"}
            </strong>
            <span>
              {feed.source === "assistant"
                ? "Usando a conta ligada na Recepcionista."
                : "Os posts novos aparecem sozinhos na página."}
            </span>
          </div>
          {canManage && feed.source === "page" && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await send("/api/workspace/instagram-feed", "DELETE");
                  toast("Instagram desligado da página.");
                })
              }
            >
              Desconectar
            </Button>
          )}
        </div>
      ) : store.mode === "demo" ? (
        <p className="payment-copy">
          Na demonstração, as fotos da casa fazem o papel dos posts. Em produção, ligue a conta
          profissional do Instagram aqui.
        </p>
      ) : canManage ? (
        <form className="management-form" onSubmit={connect}>
          <ol className="payment-steps">
            <li>
              No app do Instagram: <b>Configurações → Tipo de conta</b> → mude para conta{" "}
              <b>profissional</b> (Empresa ou Criador de conteúdo).
            </li>
            <li>
              Em <b>developers.facebook.com</b> → Meus apps → <b>Criar app</b> → caso de uso{" "}
              <b>&quot;Gerenciar mensagens e conteúdo no Instagram&quot;</b>.
            </li>
            <li>
              No app criado: <b>Instagram → Configuração da API com login do Instagram</b> →{" "}
              <b>Gerar tokens de acesso</b> → <b>Adicionar conta</b> e entre com o Instagram da
              barbearia.
            </li>
            <li>
              Toque em <b>Gerar token</b> e copie o código inteiro. Ele começa com <b>IG</b>.
              (Não é a chave secreta do app nem o token do Facebook, que começa com EAA.)
            </li>
          </ol>
          <p className="payment-copy">
            Sem token a página mostra o seu @ e as fotos da casa. O token é renovado sozinho a cada
            semana.
          </p>
          <FormField label="Token de acesso do Instagram" hint="Fica guardado cifrado no servidor.">
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              minLength={20}
            />
          </FormField>
          <Button type="submit" disabled={busy || token.trim().length < 20}>
            <InstagramIcon size={16} />
            {busy ? "Conferindo com a Meta…" : "Mostrar meus posts"}
          </Button>
        </form>
      ) : (
        <p className="payment-copy">Peça para o dono ligar o Instagram da casa.</p>
      )}
      <FormError error={error} />
    </FormSection>
  );
}
