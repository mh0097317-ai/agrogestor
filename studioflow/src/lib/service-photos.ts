/** Fotos de um serviço em ordem: a principal e até mais duas. */
export function servicePhotos(service: { image?: string; photos?: string[] }) {
  return [...new Set([service.image || "", ...(service.photos || [])].filter(Boolean))].slice(
    0,
    3,
  );
}
