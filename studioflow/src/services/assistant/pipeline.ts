export type RunState =
  | "RECEIVED"
  | "UNDERSTANDING"
  | "UNDERSTOOD"
  | "DECIDING"
  | "GENERATING"
  | "VALIDATING"
  | "SENDING"
  | "SENT"
  | "SILENT"
  | "RETRY"
  | "FAILED";
export interface RunProgress {
  state: RunState;
  interpretation?: unknown;
  errorCode?: string | null;
  retryAt?: string | null;
}

/** Fixed diagnostic codes; never expose provider payloads, prompts or keys. */
export function failureCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/credit balance|insufficient.*credit|billing|balance.*low/i.test(message))
    return "provider-balance";
  if (/thinking|signature/i.test(message)) return "thinking-history";
  if (/input_schema|strict|schema/i.test(message)) return "tool-schema";
  if (/cache_control|cache control/i.test(message)) return "cache-control";
  if (
    /interpretation|JSON|Unexpected token|ZodError/i.test(
      message + (error instanceof Error ? error.name : ""),
    )
  )
    return "interpretation-invalid";
  if (
    /timeout|timed out|abort/i.test(
      message + (error instanceof Error ? error.name : ""),
    )
  )
    return "provider-timeout";
  const status =
    error && typeof error === "object" && "status" in error
      ? error.status
      : null;
  if (status === 401 || status === 403) return "provider-auth";
  if (status === 429) return "provider-limit";
  if (status === 400) return "provider-request";
  return "provider-or-processing";
}

export function retryable(error: unknown) {
  const code = failureCode(error);
  const status =
    error && typeof error === "object" && "status" in error
      ? error.status
      : null;
  return (
    code === "provider-timeout" ||
    code === "provider-limit" ||
    code === "interpretation-invalid" ||
    (typeof status === "number" && status >= 500)
  );
}
