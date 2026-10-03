"use client";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="error-page">
      <h1>Vamos tentar de novo?</h1>
      <p>
        Não conseguimos carregar esta página. Suas informações continuam salvas.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        <ArrowCounterClockwise size={17} /> Tentar novamente
      </button>
    </div>
  );
}
