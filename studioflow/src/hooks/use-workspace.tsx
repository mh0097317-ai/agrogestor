"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Store } from "@/types";
interface Workspace {
  data: Store | null;
  loading: boolean;
  error: string;
  refreshing: boolean;
  refreshError: string;
  refresh: () => Promise<void>;
  mutate: (
    entity: string,
    action: "create" | "update" | "delete",
    data: Record<string, unknown>,
  ) => Promise<void>;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const hasData = useRef(false);
  const mounted = useRef(false);
  const currentRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    const controller = new AbortController();
    const previous = currentRequest.current;
    currentRequest.current = controller;
    previous?.abort();
    if (!hasData.current) {
      setLoading(true);
      setError("");
    }
    setRefreshing(true);
    setRefreshError("");
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    try {
      const res = await fetch("/api/workspace", {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Não foi possível carregar os dados.");
      if (currentRequest.current !== controller) return;
      setData(json.data || json);
      hasData.current = true;
      setError("");
    } catch (e) {
      if (currentRequest.current !== controller) return;
      const message = timedOut
        ? "O carregamento demorou mais que o esperado. Tente novamente."
        : e instanceof Error
          ? e.message
          : "Falha de conexão.";
      if (hasData.current) setRefreshError(message);
      else setError(message);
    } finally {
      clearTimeout(timeout);
      if (currentRequest.current === controller) {
        currentRequest.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (active) return refresh();
    });
    return () => {
      active = false;
      mounted.current = false;
      const controller = currentRequest.current;
      currentRequest.current = null;
      controller?.abort();
    };
  }, [refresh]);
  const mutate = useCallback(
    async (
      entity: string,
      action: "create" | "update" | "delete",
      values: Record<string, unknown>,
    ) => {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action, data: values }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível salvar.");
      if (mounted.current) {
        const pending = currentRequest.current;
        currentRequest.current = null;
        pending?.abort();
        setData(json.data || json);
        hasData.current = true;
        setError("");
        setRefreshError("");
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );
  return (
    <Context.Provider
      value={{
        data,
        loading,
        error,
        refreshing,
        refreshError,
        refresh,
        mutate,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider ausente");
  return value;
}
