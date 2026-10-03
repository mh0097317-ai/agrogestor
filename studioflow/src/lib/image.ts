export const imageTypes = ["image/jpeg", "image/png", "image/webp"];

/** Accepted stored image values: https URL, app path or an inline photo. */
export const storedImagePattern =
  /^(https?:\/\/|\/[^/]|data:image\/(jpeg|png|webp);base64,)/;

export type ImagePreset = {
  /** Longest side, in pixels, after resizing. */
  max: number;
  quality: number;
  /** Keep transparency (logos). */
  alpha?: boolean;
};

export const imagePresets = {
  cover: { max: 1600, quality: 0.8 },
  gallery: { max: 1200, quality: 0.78 },
  service: { max: 900, quality: 0.8 },
  person: { max: 480, quality: 0.82 },
  logo: { max: 512, quality: 0.9, alpha: true },
} satisfies Record<string, ImagePreset>;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir esta foto."));
    };
    image.src = url;
  });
}

/**
 * Resizes and re-encodes a photo in the browser so uploads stay light
 * (a phone photo of 4 MB usually becomes 100–250 KB).
 */
export async function compressImage(file: File, preset: ImagePreset) {
  if (!imageTypes.includes(file.type))
    throw new Error("Use uma foto JPG, PNG ou WebP.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Esta foto passa de 20 MB. Escolha uma menor.");
  const image = await loadImage(file);
  const scale = Math.min(
    1,
    preset.max / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu tratar a foto.");
  if (!preset.alpha) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  let value = canvas.toDataURL("image/webp", preset.quality);
  // Older Safari falls back to PNG when WebP encoding is unavailable.
  if (!value.startsWith("data:image/webp"))
    value = preset.alpha
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", preset.quality);
  if (value.length > 2_900_000)
    throw new Error("A foto ficou grande demais. Tente outra imagem.");
  return value;
}

/**
 * Sends a resized photo to the server, which stores it in Supabase Storage
 * and answers with its public URL. In the local demo the server returns the
 * inline photo unchanged.
 */
export async function storeImage(value: string) {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: value }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!response.ok || !body.url)
    throw new Error(body.error || "Não foi possível salvar a foto.");
  return body.url;
}

/** Resize in the browser, then store. */
export async function uploadImage(file: File, preset: ImagePreset) {
  return storeImage(await compressImage(file, preset));
}
