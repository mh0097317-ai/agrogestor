"use client";
import { RotateCcw } from "lucide-react";
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
        <RotateCcw size={17} /> Tentar novamente
      </button>
    </div>
  );
}
