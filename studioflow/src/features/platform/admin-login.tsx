"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CircleNotch,
  Eye,
  EyeSlash,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import "./admin-login.css";

export function AdminLogin({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível entrar.");
      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível entrar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-access">
      <aside className="admin-access-story">
        <Link href="/" aria-label="StudioFlow">
          <Brand tone="on-dark" size={40} />
        </Link>
        <div>
          <span className="admin-access-eyebrow">ADMINISTRAÇÃO STUDIOFLOW</span>
          <h1>
            Uma visão clara.
            <br />
            <em>Todos os seus clientes.</em>
          </h1>
          <p>Acompanhe estabelecimentos, planos e acessos em um só lugar.</p>
        </div>
        <span className="admin-access-security">
          <ShieldCheck size={18} /> Acesso exclusivo à administração da
          plataforma.
        </span>
      </aside>
      <section className="admin-access-panel">
        <span className="admin-access-eyebrow">PAINEL ADMINISTRATIVO</span>
        <h2>Bem-vindo à administração.</h2>
        <p>Entre com sua conta autorizada do StudioFlow.</p>
        <form onSubmit={submit} aria-busy={busy}>
          <label>
            E-mail do administrador
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <div className="admin-password">
              <input
                type={visible ? "text" : "password"}
                required
                maxLength={1024}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          {error && (
            <p className="admin-access-error" role="alert">
              {error}
            </p>
          )}
          <button className="admin-access-submit" disabled={busy || demo}>
            {busy ? (
              <>
                <CircleNotch size={18} className="is-spinning" /> Entrando…
              </>
            ) : (
              <>
                Entrar no admin <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        {demo && (
          <p className="admin-access-demo">
            Ambiente local de demonstração.{" "}
            <Link href="/admin">Explorar painel admin</Link>
          </p>
        )}
        <Link className="admin-access-back" href="/login">
          Acessar meu estabelecimento <ArrowRight size={14} />
        </Link>
      </section>
    </main>
  );
}
