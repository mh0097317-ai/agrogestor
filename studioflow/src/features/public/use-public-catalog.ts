"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicCatalog } from "./types";

export async function publicRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const isRead = ["GET", "HEAD"].includes(
    (options?.method || "GET").toUpperCase(),
  );
  const controller = new AbortController();
  const signal = options?.signal;
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });
  let timedOut = false;
  const deadline = isRead
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 20_000)
    : undefined;
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "Não foi possível concluir. Tente novamente.",
      );
    return data as T;
  } catch (cause) {
    if (timedOut)
      throw new Error(
        "O carregamento demorou mais que o esperado. Tente novamente.",
      );
    throw cause;
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

export function usePublicData<T>(url: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    url: string;
    data: T | null;
    error: string;
  }>({ key: "", url: "", data: null, error: "" });
  const key = `${url}:${revision}`;
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    publicRequest<T>(url, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted)
          setResult({ key, url, data, error: "" });
      },
      (cause) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            key,
            url,
            data: previous.url === url ? previous.data : null,
            error:
              cause instanceof Error
                ? cause.message
                : "Não foi possível carregar. Tente novamente.",
          }));
      },
    );
    return () => controller.abort();
  }, [key, url]);
  return {
    data: result.url === url ? result.data : null,
    error: result.key === key ? result.error : "",
    loading: result.key !== key,
    reload,
  };
}

export function usePublicCatalog(slug: string) {
  const { data, ...state } = usePublicData<PublicCatalog>(
    `/api/public/${encodeURIComponent(slug)}`,
  );
  return { catalog: data, ...state };
}
