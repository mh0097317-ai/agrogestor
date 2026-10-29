"use client";

import { useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  InstagramLogo,
} from "@phosphor-icons/react/dist/ssr";
import { InstagramIcon } from "@/components/brand-icons";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import type { Store } from "@/types";
import { InstagramFeedSettings } from "./instagram-feed-settings";

async function send<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/workspace/instagram-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível publicar.");
  return data as T;
}

/** A Meta só aceita JPEG: redesenha qualquer imagem do kit como JPEG. */
async function toJpeg(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("imagem"))),
      "image/jpeg",
      0.92,
    ),
  );
}

/** Topo da aba Divulgar: liga o Instagram da casa para publicar daqui. */
export function InstagramConnectCard({ store }: { store: Store }) {
  const { refresh } = useWorkspace();
  const { canManage } = usePermissions();
  const feed = store.instagramFeed;
  return (
    <Card className="share-card share-instagram">
      <h2>
        <InstagramLogo size={20} /> Postar no seu Instagram
      </h2>
      {feed ? (
        <div className="share-ig-on">
          <CheckCircle weight="fill" size={22} />
          <p>
            <b>@{feed.username || "conta conectada"}</b> está ligado. Nas artes
            abaixo, toque em <b>Postar no Instagram</b> e a publicação sai
            direto no seu perfil, sem baixar nada.
          </p>
        </div>
      ) : (
        <>
          <p>
            Ligue o Instagram do seu negócio uma vez e publique daqui as artes
            da agenda: o aviso de que agora agenda online e o story com os
            horários livres do dia.
          </p>
          <InstagramFeedSettings
            store={store}
            canManage={canManage}
            onSaved={refresh}
            title="Conectar o Instagram do estabelecimento"
            description="A mesma conexão mostra seus posts na página de agendamento. Na geração do token, deixe marcada a permissão de publicar conteúdo."
            submitLabel="Conectar Instagram"
          />
        </>
      )}
    </Card>
  );
}

/** Botão que publica a arte pronta no Instagram da casa. */
export function PostToInstagram({
  store,
  format,
  piece,
  caption = "",
  getImage,
  disabled,
}: {
  store: Store;
  format: "post" | "story";
  piece: string;
  caption?: string;
  getImage: () => Promise<string>;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const { canManage } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  if (!store.instagramFeed || !canManage) return null;
  async function publish() {
    const where = format === "story" ? "nos Stories" : "no feed";
    if (
      !window.confirm(
        `Publicar agora ${where} de @${store.instagramFeed?.username || "sua conta"}?`,
      )
    )
      return;
    setBusy(true);
    setDone(null);
    try {
      const blob = await toJpeg(await getImage());
      const target = await send<{ path: string; signedUrl: string }>({
        kind: "uploadUrl",
      });
      const sent = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
        body: blob,
      });
      if (!sent.ok) throw new Error("O envio da imagem falhou. Tente de novo.");
      const result = await send<{ permalink: string | null }>({
        kind: "publish",
        path: target.path,
        format,
        piece,
        caption,
      });
      setDone(result.permalink || "");
      toast(
        format === "story"
          ? "Story publicado no Instagram."
          : "Post publicado no Instagram.",
      );
    } catch (cause) {
      toast(
        cause instanceof Error ? cause.message : "Não foi possível publicar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        onClick={() => void publish()}
        disabled={busy || disabled || store.mode === "demo"}
      >
        <InstagramIcon size={16} />{" "}
        {busy ? "Publicando…" : "Postar no Instagram"}
      </Button>
      {done !== null &&
        (done ? (
          <a
            className="share-open"
            href={done}
            target="_blank"
            rel="noreferrer"
          >
            Ver no Instagram <ArrowSquareOut size={15} />
          </a>
        ) : (
          <span className="share-tip">Publicado.</span>
        ))}
    </>
  );
}
