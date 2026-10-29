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
import "@/components/auth-card.css";
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
  const [owner, setOwner] = useState(false);
  return (
    <main className="ac-page is-admin">
      <Link href="/" className="ac-home" aria-label="StudioFlow">
        <Brand tone="on-dark" size={34} animated />
        <span className="ac-home-caption">ADMINISTRAÇÃO DA PLATAFORMA</span>
      </Link>
      <div className={`ac-card ${owner ? "is-register" : ""}`}>
        <div className="ac-bg" aria-hidden="true">
          <span className="ac-photo-caption">
            Uma visão clara.
            <br />
            <em>Mais controle, mais cuidado.</em>
            <small>ADMINISTRAÇÃO STUDIOFLOW</small>
          </span>
        </div>

        <div className="ac-hero is-register" aria-hidden={!owner}>
          <span className="ac-hero-eyebrow">Equipe StudioFlow</span>
          <h2>Uma visão clara de todos os clientes.</h2>
          <p>
            Acessos, planos, canais, cobranças, auditoria e marketing num só
            lugar.
          </p>
          <button
            type="button"
            className="ac-switch"
            onClick={() => setOwner(false)}
            tabIndex={owner ? 0 : -1}
          >
            Entrar no admin
          </button>
        </div>
        <div className="ac-hero is-login" aria-hidden={owner}>
          <span className="ac-hero-eyebrow">Administração da plataforma</span>
          <h2>Bem-vindo de volta ao comando.</h2>
          <p>
            Uma entrada reservada para cuidar de quem cresce com a StudioFlow.
          </p>
          <button
            type="button"
            className="ac-switch"
            onClick={() => setOwner(true)}
            tabIndex={owner ? -1 : 0}
          >
            Tenho um estabelecimento
          </button>
        </div>

        <form
          className="ac-form is-login"
          onSubmit={submit}
          aria-busy={busy}
          aria-hidden={owner}
          inert={owner}
        >
          <span className="ac-eyebrow">Painel administrativo</span>
          <h1>Entrar no admin.</h1>
          <p className="ac-sub">
            Acesso reservado à equipe que administra a plataforma.
          </p>
          <label className="ac-field">
            E-mail do administrador
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@studioflowapp.tech"
              tabIndex={owner ? -1 : 0}
            />
          </label>
          <label className="ac-field">
            Senha
            <span className="ac-password">
              <input
                type={visible ? "text" : "password"}
                required
                maxLength={1024}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                tabIndex={owner ? -1 : 0}
              />
              <button
                type="button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
                tabIndex={owner ? -1 : 0}
              >
                {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          {error && (
            <p className="ac-alert is-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="ac-submit"
            disabled={busy || demo}
            tabIndex={owner ? -1 : 0}
          >
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
          {demo && (
            <p className="ac-terms">
              Ambiente local de demonstração.{" "}
              <Link href="/admin">Explorar painel admin</Link>
            </p>
          )}
          <button
            type="button"
            className="ac-mobile-switch"
            onClick={() => setOwner(true)}
          >
            Tem um estabelecimento? <b>Acesse seu painel</b>
          </button>
        </form>

        <div
          className="ac-form is-register"
          aria-hidden={!owner}
          inert={!owner}
        >
          <span className="ac-eyebrow">Seu estabelecimento</span>
          <h1>Seu negócio tem um espaço aqui.</h1>
          <p className="ac-sub">
            Acesse sua agenda, seus clientes e as ferramentas para cuidar do seu
            estabelecimento.
          </p>
          <Link href="/login" className="ac-submit" tabIndex={owner ? 0 : -1}>
            Acessar meu estabelecimento <ArrowRight size={18} />
          </Link>
          <Link
            href="/login?cadastro=1"
            className="ac-secondary"
            tabIndex={owner ? 0 : -1}
          >
            Ainda não tem conta? Criar agora
          </Link>
          <button
            type="button"
            className="ac-mobile-switch"
            onClick={() => setOwner(false)}
          >
            Sou da equipe <b>Entrar no admin</b>
          </button>
        </div>
      </div>
      <p className="ac-foot">
        <ShieldCheck size={15} /> Acesso exclusivo à administração da
        plataforma.
      </p>
    </main>
  );
}
