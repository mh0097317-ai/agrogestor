"use client";

import { Star } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import type { CustomerReview } from "@/features/public/types";
import { BusyButton } from "@/features/public/public-ui";
import { publicRequest } from "@/features/public/use-public-catalog";

const words = [
  "",
  "Ruim",
  "Poderia ser melhor",
  "Bom",
  "Muito bom",
  "Excelente",
];

function Stars({ value, size = 22 }: { value: number; size?: number }) {
  return (
    <span className="bk-stars" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          weight={star <= value ? "fill" : "regular"}
          className={star <= value ? "is-on" : ""}
        />
      ))}
    </span>
  );
}

/** Asks for a rating once the appointment is completed. */
export function ReviewCard({
  token,
  businessName,
  professionalName,
  review,
  onSaved,
}: {
  token: string;
  businessName: string;
  professionalName?: string;
  review?: CustomerReview | null;
  onSaved: (review: CustomerReview) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (review)
    return (
      <div className="bk-review is-done" role="status">
        <Stars value={review.rating} />
        <strong>Obrigado pela avaliação!</strong>
        {review.comment ? (
          <p>“{review.comment}”</p>
        ) : (
          <p>Sua nota ajuda {businessName} a melhorar cada atendimento.</p>
        )}
      </div>
    );

  async function send() {
    if (!rating) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        await publicRequest<CustomerReview>(
          `/api/booking/${encodeURIComponent(token)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ action: "review", rating, comment }),
          },
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar sua avaliação.",
      );
    } finally {
      setBusy(false);
    }
  }
  const shown = hover || rating;
  return (
    <div className="bk-review">
      <strong>Como foi seu atendimento?</strong>
      <p>
        {professionalName
          ? `Conte como foi com ${professionalName.split(" ")[0]}.`
          : "Sua opinião ajuda o estabelecimento."}
      </p>
      <div
        className="bk-star-picker"
        role="radiogroup"
        aria-label="Sua nota"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}, ${words[star]}`}
            className={star <= shown ? "is-on" : ""}
            onMouseEnter={() => setHover(star)}
            onClick={() => setRating(star)}
            disabled={busy}
          >
            <Star size={34} weight={star <= shown ? "fill" : "regular"} />
          </button>
        ))}
      </div>
      <span className="bk-star-word" aria-live="polite">
        {shown ? words[shown] : "Toque nas estrelas"}
      </span>
      {rating > 0 && (
        <div className="bk-review-more">
          <label htmlFor="review-comment" className="bk-label">
            Quer deixar um comentário? <small>opcional</small>
          </label>
          <textarea
            id="review-comment"
            maxLength={500}
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="O que você mais gostou?"
          />
          {error && (
            <div className="bk-alert" role="alert">
              <p>{error}</p>
            </div>
          )}
          <BusyButton
            busy={busy}
            onClick={() => void send()}
            className="bk-primary"
          >
            Enviar avaliação
          </BusyButton>
        </div>
      )}
    </div>
  );
}
