import { DomainError } from "@/lib/availability";

const apiBase = "https://generativelanguage.googleapis.com/v1beta";
const model = "veo-3.1-generate-preview";
const providerError = (status: number) => {
  if (status === 401 || status === 403)
    return new DomainError(
      "O Google recusou a chave ou não liberou a geração de vídeo para ela.",
      status,
    );
  if (status === 429)
    return new DomainError(
      "O limite ou saldo de vídeo do Google foi atingido. Confira o faturamento e a cota da conta.",
      429,
    );
  if (status >= 500)
    return new DomainError(
      "A geração de vídeo do Google está indisponível agora. Tente novamente mais tarde.",
      503,
    );
  return new DomainError(
    "O Google não aceitou a geração. Confira o prompt e as opções do vídeo.",
    400,
  );
};

export function isVideoOperationName(name: string) {
  return new RegExp(`^models/${model}/operations/[A-Za-z0-9_-]{8,160}$`).test(
    name,
  );
}

export async function validateGoogleVideoKey(
  key: string,
  request: typeof fetch = fetch,
) {
  try {
    const response = await request(`${apiBase}/models/${model}`, {
      headers: { "x-goog-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw providerError(response.status);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      "Não foi possível validar a chave do Google. A chave anterior foi preservada.",
      503,
    );
  }
}

export async function startGoogleVideo(
  input: {
    key: string;
    prompt: string;
    aspectRatio: "9:16" | "16:9";
    resolution: "720p" | "1080p";
  },
  request: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await request(`${apiBase}/models/${model}:predictLongRunning`, {
      method: "POST",
      headers: {
        "x-goog-api-key": input.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt: input.prompt }],
        parameters: {
          aspectRatio: input.aspectRatio,
          resolution: input.resolution,
          sampleCount: 1,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new DomainError(
      "Não foi possível iniciar a geração no Google. Tente novamente.",
      503,
    );
  }
  const body = (await response.json().catch(() => ({}))) as {
    name?: string;
  };
  if (!response.ok) throw providerError(response.status);
  if (!body.name || !isVideoOperationName(body.name))
    throw new DomainError(
      "O Google iniciou a geração sem retornar um identificador válido.",
      502,
    );
  return body.name;
}

export async function getGoogleVideoOperation(
  key: string,
  operationName: string,
  request: typeof fetch = fetch,
) {
  if (!isVideoOperationName(operationName))
    throw new DomainError("Geração de vídeo não encontrada.", 404);
  let response: Response;
  try {
    response = await request(`${apiBase}/${operationName}`, {
      headers: { "x-goog-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new DomainError(
      "Não foi possível consultar a geração. Tente de novo em instantes.",
      503,
    );
  }
  const body = (await response.json().catch(() => ({}))) as {
    done?: boolean;
    error?: { code?: number; message?: string };
    response?: {
      generateVideoResponse?: {
        generatedSamples?: { video?: { uri?: string } }[];
      };
      generatedVideos?: { video?: { uri?: string } }[];
    };
  };
  if (!response.ok) throw providerError(response.status);
  if (body.error) throw providerError(body.error.code || 500);
  const videoUri =
    body.response?.generatedVideos?.[0]?.video?.uri ||
    body.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  return { done: !!body.done, videoUri };
}

export async function downloadGoogleVideo(
  key: string,
  videoUri: string,
  request: typeof fetch = fetch,
) {
  let url: URL;
  try {
    url = new URL(videoUri);
  } catch {
    throw new DomainError(
      "O Google retornou um arquivo de vídeo inválido.",
      502,
    );
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "generativelanguage.googleapis.com"
  )
    throw new DomainError(
      "O Google retornou um endereço de vídeo inválido.",
      502,
    );
  let response: Response;
  try {
    response = await request(url, {
      headers: { "x-goog-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new DomainError("Não foi possível baixar o vídeo gerado.", 503);
  }
  if (!response.ok) throw providerError(response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 100 * 1024 * 1024)
    throw new DomainError(
      "O vídeo veio vazio ou ultrapassa o limite de 100 MB.",
      413,
    );
  return bytes;
}
