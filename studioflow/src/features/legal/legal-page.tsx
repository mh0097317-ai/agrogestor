import Link from "next/link";
import "./legal.css";
import { legal } from "./legal";

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legal">
      <div className="legal-wrap">
        <Link href="/" className="legal-brand">
          Studio<i>Flow</i>
        </Link>
        <small className="legal-eyebrow">{eyebrow}</small>
        <h1>{title}</h1>
        <p className="legal-updated">Atualizado em {legal.updated}</p>
        <div className="legal-summary">
          <p>{summary}</p>
        </div>
        {children}
        <nav className="legal-foot" aria-label="Documentos">
          <Link href="/termos">Termos de Uso</Link>
          <Link href="/privacidade">Política de Privacidade</Link>
          <a href={`mailto:${legal.email}`}>{legal.email}</a>
        </nav>
      </div>
    </main>
  );
}
