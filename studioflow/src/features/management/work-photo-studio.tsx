"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  Copy,
  DownloadSimple,
  ShareNetwork,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { compressImage } from "@/lib/image";
import type { Store } from "@/types";
import { FormError, FormField } from "./shared";
import { PostToInstagram } from "./instagram-publish";
import { usePermissions } from "@/hooks/use-permissions";

type Artwork = {
  photo: string;
  title: string;
  business: string;
  contact: string;
  format: "post" | "story";
};

async function renderArtwork(input: Artwork) {
  const image = new Image();
  image.src = input.photo;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = input.format === "story" ? 1920 : 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu montar a arte.");
  const photoHeight = canvas.height - 370;
  const ratio = Math.max(
    1080 / image.naturalWidth,
    photoHeight / image.naturalHeight,
  );
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(0, 0, 1080, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 1080, photoHeight);
  ctx.clip();
  ctx.drawImage(
    image,
    (1080 - image.naturalWidth * ratio) / 2,
    (photoHeight - image.naturalHeight * ratio) / 2,
    image.naturalWidth * ratio,
    image.naturalHeight * ratio,
  );
  ctx.restore();
  ctx.fillStyle = "#16130f";
  ctx.fillRect(0, photoHeight, 1080, 8);
  ctx.fillStyle = "#64666a";
  ctx.font = "600 25px sans-serif";
  ctx.fillText(
    input.business.toLocaleUpperCase("pt-BR"),
    64,
    photoHeight + 68,
    950,
  );
  ctx.fillStyle = "#16130f";
  ctx.font = "500 58px Georgia";
  const words = input.title.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 950 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines
    .slice(0, 2)
    .forEach((text, index) =>
      ctx.fillText(text, 64, photoHeight + 145 + index * 65, 950),
    );
  ctx.font = "400 25px sans-serif";
  ctx.fillStyle = "#64666a";
  ctx.fillText("SEU PRÓXIMO VISUAL COMEÇA AQUI", 64, canvas.height - 91, 950);
  ctx.font = "400 23px sans-serif";
  ctx.fillStyle = "#54565a";
  ctx.fillText(input.contact, 64, canvas.height - 48, 950);
  return canvas.toDataURL("image/jpeg", 0.94);
}

export function WorkPhotoStudio({
  store,
  bookingUrl,
}: {
  store: Store;
  bookingUrl: string;
}) {
  const { toast } = useToast();
  const { canManage } = usePermissions();
  const [objective, setObjective] = useState("");
  const [improving, setImproving] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    title: string;
    caption: string;
  } | null>(null);
  async function improve() {
    setImproving(true);
    setError("");
    setSuggestion(null);
    try {
      const r = await fetch("/api/workspace/share-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, caption, objective }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Não foi possível melhorar.");
      setSuggestion(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tente novamente.");
    } finally {
      setImproving(false);
    }
  }
  const [photo, setPhoto] = useState("");
  const [title, setTitle] = useState("Um novo visual. Seu próximo momento.");
  const [format, setFormat] = useState<"post" | "story">("post");
  const [caption, setCaption] = useState(
    () =>
      `Detalhes que fazem a diferença ✨\n\nUm pouco do nosso trabalho na ${store.business.name}. Gostou do resultado? Fale com a gente e escolha seu próximo atendimento.\n\n${bookingUrl}`,
  );
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const contact = store.business.instagram || store.business.name;
  useEffect(() => {
    let live = true;
    if (photo)
      void renderArtwork({
        photo,
        title,
        format,
        business: store.business.name,
        contact,
      })
        .then((value) => {
          if (live) setPreview(value);
        })
        .catch(() => {
          if (live)
            setError("Não foi possível montar a prévia. Escolha outra foto.");
        });
    return () => {
      live = false;
    };
  }, [photo, title, format, store.business.name, contact]);
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setPhoto(await compressImage(file, { max: 1920, quality: 0.9 }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir a foto.",
      );
    } finally {
      setBusy(false);
    }
  }
  const getImage = () =>
    renderArtwork({
      photo,
      title,
      format,
      business: store.business.name,
      contact,
    });
  async function download() {
    try {
      const a = document.createElement("a");
      a.href = await getImage();
      a.download = `${store.business.slug}-${format}.jpg`;
      a.click();
    } catch {
      setError("Não foi possível baixar a arte. Tente outra foto.");
    }
  }
  async function share() {
    try {
      const blob = await (await fetch(await getImage())).blob();
      const file = new File([blob], `${store.business.slug}-${format}.jpg`, {
        type: "image/jpeg",
      });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], text: caption });
      else {
        await download();
        toast(
          "Arte baixada. Copie a legenda e publique no aplicativo de sua preferência.",
        );
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setError(
          "Não foi possível compartilhar. Use Baixar arte e Copiar legenda.",
        );
    }
  }
  return (
    <Card className="work-studio">
      <header>
        <span className="sheet-eyebrow">Seu estúdio de conteúdo</span>
        <h2>Seu trabalho. O próximo post.</h2>
        <p>
          Escolha uma foto do resultado, dê seu toque na legenda e leve seu
          trabalho para o feed, os Stories ou o Status.
        </p>
      </header>
      <div className="work-studio-grid">
        <div className="management-form work-studio-editor">
          <div className="work-editor-heading">
            <span>01</span>
            <strong>Prepare sua publicação</strong>
          </div>
          <label className="work-photo-input">
            <Camera size={26} />
            <strong>
              {busy
                ? "Preparando sua foto…"
                : photo
                  ? "Trocar foto do resultado"
                  : "Escolher foto do trabalho"}
            </strong>
            <span>JPG, PNG ou WebP · até 20 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div
            className="work-format-options"
            role="group"
            aria-label="Formato da publicação"
          >
            <button
              type="button"
              aria-pressed={format === "post"}
              onClick={() => setFormat("post")}
            >
              <span className="work-format-feed" aria-hidden="true" />
              Feed<small>Foto em destaque</small>
            </button>
            <button
              type="button"
              aria-pressed={format === "story"}
              onClick={() => setFormat("story")}
            >
              <span className="work-format-story" aria-hidden="true" />
              Stories e Status<small>Ocupe a tela inteira</small>
            </button>
          </div>
          <FormField label="Chamada da arte">
            <input
              value={title}
              maxLength={65}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField
            label="Legenda para acompanhar"
            hint="Personalize com o serviço realizado e marque o profissional."
          >
            <textarea
              value={caption}
              maxLength={2200}
              rows={6}
              onChange={(e) => setCaption(e.target.value)}
            />
          </FormField>
          <div className="share-actions">
            {canManage && (
              <Button
                variant="secondary"
                type="button"
                disabled={improving || busy || caption.trim().length < 5}
                onClick={() => void improve()}
              >
                <Sparkle size={17} />
                {improving ? "Melhorando o texto…" : "Melhorar com IA"}
              </Button>
            )}
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(caption)
                  .then(() => toast("Legenda copiada."))
                  .catch(() =>
                    setError("Selecione a legenda e copie manualmente."),
                  );
              }}
            >
              <Copy size={17} /> Copiar legenda
            </Button>
          </div>
          {canManage && (
            <FormField
              label="O que você quer destacar? (opcional)"
              hint="A IA melhora a chamada e a legenda. Não altera sua foto e pode consumir créditos."
            >
              <input
                maxLength={400}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex.: mostrar a finalização e convidar para conhecer o espaço"
              />
            </FormField>
          )}
          {suggestion && (
            <div className="share-copy-suggestion">
              <strong>Sugestão da IA · revise antes de usar</strong>
              <FormField label="Chamada sugerida">
                <input
                  value={suggestion.title}
                  maxLength={65}
                  onChange={(e) =>
                    setSuggestion({ ...suggestion, title: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Legenda sugerida">
                <textarea
                  rows={5}
                  maxLength={2200}
                  value={suggestion.caption}
                  onChange={(e) =>
                    setSuggestion({ ...suggestion, caption: e.target.value })
                  }
                />
              </FormField>
              <Button
                type="button"
                onClick={() => {
                  setTitle(suggestion.title);
                  setCaption(suggestion.caption);
                  setSuggestion(null);
                }}
              >
                Usar sugestão
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSuggestion(null)}
              >
                Descartar sugestão
              </Button>
            </div>
          )}
          <small className="share-tip">
            Use fotos que você tem autorização para divulgar. A foto fica neste
            navegador até você compartilhar ou publicar.
          </small>
          <FormError error={error} />
        </div>
        <div className="work-studio-result">
          <div className="work-preview-label">
            <span>02</span>
            <strong>Sua publicação ganha forma</strong>
          </div>
          <div
            className={`work-studio-preview ${format === "story" ? "is-story" : ""} ${!photo ? "is-empty" : ""}`}
          >
            {photo && preview ? (
              <img
                src={preview}
                alt="Prévia da publicação com sua foto, chamada e nome do estabelecimento"
              />
            ) : (
              <div>
                <Camera size={48} weight="thin" />
                <span>
                  A próxima inspiração
                  <br />
                  pode ser sua.
                </span>
                <small>
                  Sua foto, sua assinatura.
                  <br />
                  Escolha um resultado para ver a prévia.
                </small>
              </div>
            )}
          </div>
          <div className="share-actions">
            <Button
              type="button"
              disabled={!photo || busy}
              onClick={() => void download()}
            >
              <DownloadSimple size={17} /> Baixar arte
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!photo || busy}
              onClick={() => void share()}
            >
              <ShareNetwork size={17} /> Compartilhar
            </Button>
            <PostToInstagram
              store={store}
              format={format}
              piece="foto-resultado"
              caption={caption}
              getImage={getImage}
              disabled={!photo || busy}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
