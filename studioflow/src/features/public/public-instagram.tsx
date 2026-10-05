"use client";

import { ArrowUpRight, Copy as Carousel, Play, X } from "@phosphor-icons/react/dist/ssr";
import { InstagramIcon } from "@/components/brand-icons";
import type { InstagramFeed } from "@/services/instagram-feed";
import { PublicModal } from "./public-modal";
import { usePublicData } from "./use-public-catalog";

const count = (value: number) =>
  value >= 10_000
    ? `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : value.toLocaleString("pt-BR");

/** The house Instagram inside the page: profile, numbers and recent posts. */
export function InstagramSheet({
  slug,
  profileUrl,
  handle,
  fallbackPhotos,
  businessName,
  onClose,
}: {
  slug: string;
  profileUrl: string;
  handle: string;
  /** House photos shown when no account is connected yet. */
  fallbackPhotos: string[];
  businessName: string;
  onClose: () => void;
}) {
  const { data, loading } = usePublicData<InstagramFeed>(
    `/api/public/${encodeURIComponent(slug)}/instagram`,
  );
  const username = data?.username || handle;
  const live = data?.connected && data.posts.length > 0;
  const photos = live ? [] : [...new Set(fallbackPhotos)].slice(0, 9);
  return (
    <PublicModal labelId="instagram-title" onClose={onClose} variant="sheet">
      <header className="sheet-head ig-head">
        <span className={`ig-avatar ${data?.avatar ? "has-photo" : ""}`}>
          {data?.avatar ? (
            <img src={data.avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            <InstagramIcon size={26} />
          )}
        </span>
        <span className="ig-who">
          <h2 id="instagram-title">@{username}</h2>
          {data?.name && <span>{data.name}</span>}
        </span>
        <button type="button" className="sheet-close" aria-label="Fechar" onClick={onClose}>
          <X size={18} weight="bold" />
        </button>
      </header>
      {data?.connected && (data.followers !== null || data.postsCount !== null) && (
        <dl className="ig-stats">
          {data.postsCount !== null && (
            <div>
              <dt>posts</dt>
              <dd>{count(data.postsCount)}</dd>
            </div>
          )}
          {data.followers !== null && (
            <div>
              <dt>seguidores</dt>
              <dd>{count(data.followers)}</dd>
            </div>
          )}
        </dl>
      )}
      <a href={profileUrl} target="_blank" rel="noreferrer" className="sheet-primary ig-follow">
        <InstagramIcon size={18} /> Seguir no Instagram
      </a>
      {loading && !data ? (
        <div className="ig-grid is-loading" aria-label="Carregando posts" aria-busy="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className="ig-tile" />
          ))}
        </div>
      ) : live ? (
        <ul className="ig-grid" role="list" aria-label="Posts recentes">
          {data!.posts.map((post, index) => (
            <li key={post.id} style={{ "--i": index } as React.CSSProperties}>
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="ig-tile"
                aria-label={post.caption ? `Post: ${post.caption}` : `Post ${index + 1} no Instagram`}
              >
                <img src={post.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                {post.type !== "image" && (
                  <span className="ig-kind" aria-hidden="true">
                    {post.type === "video" ? (
                      <Play size={14} weight="fill" />
                    ) : (
                      <Carousel size={14} weight="fill" />
                    )}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      ) : photos.length ? (
        <>
          <p className="ig-label">Fotos de {businessName}</p>
          <ul className="ig-grid" role="list">
            {photos.map((photo, index) => (
              <li key={photo} style={{ "--i": index } as React.CSSProperties}>
                <span className="ig-tile">
                  <img src={photo} alt="" loading="lazy" />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <a href={profileUrl} target="_blank" rel="noreferrer" className="ig-more">
        Ver tudo no Instagram <ArrowUpRight size={15} weight="bold" />
      </a>
    </PublicModal>
  );
}
