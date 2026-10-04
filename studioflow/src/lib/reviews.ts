import type { Review } from "@/types";

export interface RatingSummary {
  average: number;
  count: number;
}

/** Average of real reviews, rounded to one decimal; undefined when none. */
export function ratingSummary(
  reviews: Review[] = [],
  professionalId?: string,
): RatingSummary | undefined {
  const list = professionalId
    ? reviews.filter((review) => review.professionalId === professionalId)
    : reviews;
  if (!list.length) return undefined;
  const total = list.reduce((sum, review) => sum + review.rating, 0);
  return {
    average: Math.round((total / list.length) * 10) / 10,
    count: list.length,
  };
}

/** "4,9" */
export function ratingLabel(rating: RatingSummary) {
  return rating.average.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
