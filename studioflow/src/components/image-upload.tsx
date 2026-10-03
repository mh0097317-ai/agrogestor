"use client";

import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CircleNotch,
  ImagesSquare,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { compressImage, imagePresets, imageTypes } from "@/lib/image";
import "./image-upload.css";

type Preset = keyof typeof imagePresets;
const accept = imageTypes.join(",");

function imageFiles(files: FileList | null | undefined) {
  return Array.from(files ?? []).filter((file) =>
    file.type.startsWith("image/"),
  );
}

export function ImageUpload({
  label,
  hint,
  value,
  defaultValue = "",
  onChange,
  name,
  preset,
  shape = "wide",
  emptyTitle = "Adicionar foto",
  emptyText = "Toque para escolher ou arraste uma foto",
  fallback,
  disabled = false,
  onBusy,
}: {
  label: string;
  hint?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Adds a hidden input so FormData-based forms receive the photo. */
  name?: string;
  preset: Preset;
  shape?: "wide" | "card" | "round" | "square";
  emptyTitle?: string;
  emptyText?: string;
  fallback?: ReactNode;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [broken, setBroken] = useState("");
  const current = value ?? inner;
  const locked = disabled || busy;

  function update(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
  }
  async function take(file?: File) {
    if (!file || locked) return;
    setError("");
    setBusy(true);
    onBusy?.(true);
    try {
      update(await compressImage(file, imagePresets[preset]));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível usar esta foto.",
      );
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void take(imageFiles(event.dataTransfer.files)[0]);
  }
  const showImage = current && broken !== current;

  return (
    <div className={`image-field shape-${shape}`}>
      <div className="image-field-head">
        <span id={`${id}-label`}>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div
        className={`image-drop ${dragging ? "is-dragging" : ""} ${showImage ? "has-image" : ""} ${locked ? "is-locked" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        {showImage ? (
          <img
            key={current}
            src={current}
            alt=""
            className="image-drop-photo"
            onError={() => setBroken(current)}
          />
        ) : (
          <button
            type="button"
            className="image-drop-empty"
            disabled={locked}
            aria-describedby={`${id}-label`}
            onClick={() => input.current?.click()}
          >
            {fallback ?? (
              <span className="image-drop-icon">
                <Camera size={24} weight="duotone" />
              </span>
            )}
            {(shape === "wide" || shape === "card") && (
              <>
                <strong>{emptyTitle}</strong>
                <small>{emptyText}</small>
              </>
            )}
          </button>
        )}
        {busy && (
          <span className="image-drop-busy" role="status">
            <CircleNotch size={22} weight="bold" className="image-spin" />
            Preparando foto…
          </span>
        )}
      </div>
      <div className="image-field-actions">
        <button
          type="button"
          className="image-action"
          disabled={locked}
          onClick={() => input.current?.click()}
        >
          <Camera size={16} weight="duotone" />
          {current ? "Trocar foto" : "Escolher foto"}
        </button>
        {current && (
          <button
            type="button"
            className="image-action is-danger"
            disabled={locked}
            onClick={() => {
              setError("");
              update("");
            }}
          >
            <Trash size={16} weight="duotone" />
            Remover
          </button>
        )}
      </div>
      {error && (
        <p className="image-field-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void take(file);
        }}
      />
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}

export function GalleryUpload({
  label,
  hint,
  value,
  onChange,
  max = 12,
  disabled = false,
  onBusy,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const busy = Boolean(progress);
  const locked = disabled || busy;
  const room = max - value.length;

  async function add(files: File[]) {
    if (locked || !files.length) return;
    setError("");
    const accepted = files.slice(0, room);
    if (files.length > room)
      setError(
        room
          ? `A galeria aceita até ${max} fotos. Adicionamos as ${room} primeiras.`
          : `A galeria já tem ${max} fotos. Remova alguma para adicionar outra.`,
      );
    if (!accepted.length) return;
    onBusy?.(true);
    const added: string[] = [];
    const failures: string[] = [];
    for (const [index, file] of accepted.entries()) {
      setProgress({ done: index, total: accepted.length });
      try {
        added.push(await compressImage(file, imagePresets.gallery));
      } catch {
        failures.push(file.name);
      }
    }
    setProgress(undefined);
    onBusy?.(false);
    if (added.length) onChange([...value, ...added]);
    if (failures.length)
      setError(
        failures.length === 1
          ? `Não foi possível usar a foto ${failures[0]}.`
          : `${failures.length} fotos não puderam ser usadas.`,
      );
  }
  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="gallery-field">
      <div className="image-field-head">
        <span>{label}</span>
        <em>
          {value.length} de {max}
        </em>
        {hint && <small>{hint}</small>}
      </div>
      <div
        className={`gallery-grid ${dragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked && room > 0) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void add(imageFiles(event.dataTransfer.files));
        }}
      >
        {value.map((photo, index) => (
          <figure className="gallery-tile" key={`${index}-${photo.slice(-24)}`}>
            <img src={photo} alt={`Foto ${index + 1} da galeria`} />
            {index === 0 && <span className="gallery-badge">Destaque</span>}
            <div className="gallery-tile-actions">
              <button
                type="button"
                aria-label={`Mover foto ${index + 1} para trás`}
                disabled={locked || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowLeft size={15} weight="bold" />
              </button>
              <button
                type="button"
                aria-label={`Mover foto ${index + 1} para frente`}
                disabled={locked || index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowRight size={15} weight="bold" />
              </button>
              <button
                type="button"
                className="is-danger"
                aria-label={`Remover foto ${index + 1}`}
                disabled={locked}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash size={15} weight="bold" />
              </button>
            </div>
          </figure>
        ))}
        {room > 0 && (
          <button
            type="button"
            className="gallery-add"
            disabled={locked}
            onClick={() => input.current?.click()}
          >
            {busy ? (
              <>
                <CircleNotch size={22} weight="bold" className="image-spin" />
                <strong>
                  {progress!.done + 1} de {progress!.total}
                </strong>
                <small>Preparando fotos…</small>
              </>
            ) : (
              <>
                <span className="image-drop-icon">
                  {value.length ? (
                    <Plus size={20} weight="bold" />
                  ) : (
                    <ImagesSquare size={24} weight="duotone" />
                  )}
                </span>
                <strong>
                  {value.length ? "Adicionar" : "Adicionar fotos"}
                </strong>
                <small>
                  {value.length ? `Mais ${room}` : "Escolha várias de uma vez"}
                </small>
              </>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="image-field-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void add(files);
        }}
      />
    </div>
  );
}
