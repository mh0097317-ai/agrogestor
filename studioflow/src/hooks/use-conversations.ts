"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { ConversationSummary } from "@/types";
import type { OperationSnapshot } from "@/lib/operation-health";

interface State<T> {
  value: T | null;
  error: string;
  busy: boolean;
  updatedAt: number | null;
}
const idle: State<never> = {
  value: null,
  error: "",
  busy: false,
  updatedAt: null,
};

/**
 * Uma consulta compartilhada por todos os componentes da tela: o menu, o
 * Início e o card do WhatsApp leem o mesmo resultado em vez de cada um buscar.
 */
function poll<T>(url: string, every: number) {
  let state: State<T> = idle;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let inflight: Promise<void> | null = null;
  const set = (next: Partial<State<T>>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const load = () => {
    if (inflight) return inflight;
    set({ busy: true });
    inflight = (async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Não foi possível atualizar.");
        set({
          value: (await response.json()) as T,
          error: "",
          updatedAt: Date.now(),
        });
      } catch (e) {
        set({
          error: e instanceof Error ? e.message : "Não foi possível atualizar.",
        });
      } finally {
        inflight = null;
        set({ busy: false });
      }
    })();
    return inflight;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (!timer) {
      void load();
      timer = setInterval(() => void load(), every);
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  };
  return { subscribe, load, get: () => state };
}

const noop = () => () => {};
const getIdle = () => idle;

function usePoll<T>(source: ReturnType<typeof poll<T>>, enabled: boolean) {
  const current = useSyncExternalStore<State<T>>(
    enabled ? source.subscribe : noop,
    enabled ? source.get : getIdle,
    getIdle,
  );
  const reload = useCallback(() => source.load(), [source]);
  return { ...current, reload };
}

const conversations = poll<ConversationSummary[]>(
  "/api/workspace/conversations",
  60_000,
);
const operation = poll<OperationSnapshot>("/api/workspace/operation", 300_000);

/** `enabled: false` não consulta nada (plano sem recepcionista, sem acesso). */
export function useConversations(enabled = true) {
  const { value, ...rest } = usePoll(conversations, enabled);
  return { list: value, ...rest };
}

/** Última execução da IA (só a gestão pode consultar a operação). */
export function useLatestRun(enabled = true) {
  const { value } = usePoll(operation, enabled);
  return value?.runs[0] ?? null;
}
