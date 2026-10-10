"use client";

import { useEffect, useState } from "react";
import { DeviceMobile, Export, PlusSquare, X } from "@phosphor-icons/react/dist/ssr";
import "./install-app.css";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const key = (slug: string) => `studioflow:install-dismissed:${slug}`;

function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function dismissedRecently(slug: string) {
  try {
    const at = Number(localStorage.getItem(key(slug)) || 0);
    return Date.now() - at < 21 * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * "Instalar o app da casa": no Android usa o convite do navegador; no iPhone
 * mostra o passo a passo (Compartilhar → Adicionar à Tela de Início).
 */
export function InstallApp({
  slug,
  name,
  variant = "card",
}: {
  slug: string;
  name: string;
  variant?: "card" | "inline";
}) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    // "?instalar=1" vem do comprovante: mostra na hora, mesmo se dispensado antes.
    const forced = new URLSearchParams(window.location.search).has("instalar");
    if (standalone() || (variant === "card" && !forced && dismissedRecently(slug))) return;
    const ua = navigator.userAgent;
    const apple = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    let timer = 0;
    if (apple)
      timer = window.setTimeout(() => {
        setIos(true);
        setVisible(true);
      }, variant === "card" && !forced ? 2500 : 0);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [slug, variant]);
  if (!visible) return null;
  function dismiss() {
    try {
      localStorage.setItem(key(slug), String(Date.now()));
    } catch {
      // Opcional.
    }
    setVisible(false);
  }
  async function install() {
    if (ios || !prompt) {
      setGuide(true);
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (outcome === "accepted") setVisible(false);
    setPrompt(null);
  }
  return (
    <>
      <div className={`install-app is-${variant}`} role="region" aria-label="Instalar app">
        <span className="install-app-icon" aria-hidden="true">
          <DeviceMobile size={22} weight="duotone" />
        </span>
        <span className="install-app-text">
          <strong>Tenha a {name} no celular</strong>
          <small>Agende em dois toques, direto da tela de início.</small>
        </span>
        <button type="button" className="install-app-go" onClick={() => void install()}>
          Instalar
        </button>
        {variant === "card" && (
          <button type="button" className="install-app-close" aria-label="Agora não" onClick={dismiss}>
            <X size={16} />
          </button>
        )}
      </div>
      {guide && (
        <div className="install-guide" role="dialog" aria-modal="true" aria-label="Como instalar">
          <button type="button" className="install-guide-backdrop" aria-label="Fechar" onClick={() => setGuide(false)} />
          <div className="install-guide-sheet">
            <strong>Instalar no iPhone</strong>
            <ol>
              <li>
                Toque em <Export size={18} weight="bold" aria-label="Compartilhar" /> <b>Compartilhar</b>, na barra do Safari.
              </li>
              <li>
                Escolha <PlusSquare size={18} weight="bold" aria-hidden="true" /> <b>Adicionar à Tela de Início</b>.
              </li>
              <li>
                Toque em <b>Adicionar</b>. O ícone da {name} aparece junto dos seus apps.
              </li>
            </ol>
            <button type="button" className="install-app-go" onClick={() => setGuide(false)}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
