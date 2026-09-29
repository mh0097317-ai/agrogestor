"use client";

import { useEffect } from "react";
import { marcarAvisosLidos } from "@/modules/painel/actions";

/** Ao abrir a tela de avisos, zera o contador do sino. */
export function MarcarLidos() {
  useEffect(() => {
    const t = setTimeout(() => void marcarAvisosLidos(), 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
