"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArticleStatus } from "@a4a/db";
import { saveArticle, setArticleHidden, transitionArticle, type ArticleInput } from "@/lib/actions/article-actions";
import { RichTextEditor } from "./rich-text-editor";
import { STATUS_META } from "./status-chip";

type BlockType = "paragraph" | "richtext" | "h2" | "quote" | "callout" | "image" | "kpi" | "note";
type CalloutVariant = "orange" | "blue" | "teal" | "red" | "green" | "purple";
type Block = {
  type: BlockType;
  text?: string;
  html?: string;
  cite?: string;
  url?: string;
  alt?: string;
  variant?: CalloutVariant;
};

export type EditorArticle = {
  id: string | null;
  title: string;
  kicker: string;
  dek: string;
  rubriqueId: string;
  premium: boolean;
  sponsored: boolean;
  sponsorName: string;
  tags: string[];
  status: ArticleStatus;
  scheduledAt: string | null; // valeur pour <input datetime-local>
  coverAssetId: string | null;
  featuredRank: number | null;
  hidden: boolean;
  slug: string | null;
  blocks: Block[];
};

export type RubriqueOption = { id: string; slug: string; name: string; color: string };
export type MediaOption = { id: string; url: string; alt: string | null };

const BLOCK_LABEL: Record<BlockType, string> = {
  richtext: "Texte enrichi",
  paragraph: "Paragraphe simple",
  h2: "Intertitre",
  quote: "Citation",
  callout: "Encadré",
  kpi: "Chiffres clés",
  note: "Vérification",
  image: "Média",
};

const CALLOUT_COLORS: Array<[CalloutVariant, string]> = [
  ["orange", "#F47920"],
  ["blue", "#1a3a5c"],
  ["teal", "#006e5a"],
  ["red", "#a01520"],
  ["green", "#006633"],
  ["purple", "#7C3A8C"],
];

export function ArticleEditor({
  initial,
  rubriques,
  canPublish,
  authorName,
  mediaOptions = [],
}: {
  initial: EditorArticle;
  rubriques: RubriqueOption[];
  canPublish: boolean;
  authorName: string;
  mediaOptions?: MediaOption[];
}) {
  const router = useRouter();
  const [article, setArticle] = useState(initial);
  const [tagInput, setTagInput] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [rechercheImage, setRechercheImage] = useState("");
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof EditorArticle>(key: K, value: EditorArticle[K]) =>
    setArticle((a) => ({ ...a, [key]: value }));

  const setBlock = (i: number, patch: Partial<Block>) =>
    setArticle((a) => ({ ...a, blocks: a.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const addBlock = (type: Block["type"]) =>
    setArticle((a) => ({ ...a, blocks: [...a.blocks, { type, text: "" }] }));
  const removeBlock = (i: number) =>
    setArticle((a) => ({ ...a, blocks: a.blocks.filter((_, j) => j !== i) }));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setArticle((a) => {
      const blocks = [...a.blocks];
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return a;
      [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
      return { ...a, blocks };
    });

  const words = useMemo(
    () => article.blocks.map((b) => b.text ?? "").join(" ").split(/\s+/).filter(Boolean).length,
    [article.blocks]
  );

  const rubrique = rubriques.find((r) => r.id === article.rubriqueId);
  const statusMeta = STATUS_META[article.status];

  // Couverture réelle sélectionnée ? (un placeholder du seed ne compte pas.)
  // Sert d'indice avant publication — le contrôle qui fait foi est côté serveur.
  const aUneVraieCouverture = mediaOptions.some(
    (m) => m.id === article.coverAssetId && !m.url.startsWith("placeholder://")
  );

  function toInput(): ArticleInput {
    return {
      id: article.id ?? undefined,
      title: article.title,
      kicker: article.kicker || undefined,
      dek: article.dek || undefined,
      rubriqueId: article.rubriqueId,
      premium: article.premium,
      sponsored: article.sponsored,
      sponsorName: article.sponsored ? article.sponsorName.trim() || undefined : undefined,
      tags: article.tags,
      scheduledAt: article.scheduledAt ? new Date(article.scheduledAt).toISOString() : null,
      coverAssetId: article.coverAssetId,
      featuredRank: article.featuredRank,
      blocks: article.blocks,
    };
  }

  function run(action?: Parameters<typeof transitionArticle>[1]) {
    setMessage(null);
    startTransition(async () => {
      const saved = await saveArticle(toInput());
      if (!saved.ok) return setMessage({ kind: "error", text: saved.error });
      let id = saved.id;
      if (action) {
        const t = await transitionArticle(id, action);
        if (!t.ok) return setMessage({ kind: "error", text: t.error });
        const nextStatus: Record<typeof action, ArticleStatus> = {
          submit_review: "review",
          back_to_draft: "draft",
          schedule: "scheduled",
          publish: "published",
          unpublish: "draft",
        };
        set("status", nextStatus[action]);
      }
      setMessage({ kind: "ok", text: action ? "Statut mis à jour." : "Enregistré." });
      if (!article.id) router.replace(`/admin/articles/${id}`);
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-[8px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_320px]">
      {/* ====== ÉDITEUR ====== */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between border-b border-line-2 bg-surface-2 px-[22px] py-3">
          <span className="inline-flex items-center gap-[7px] text-xs font-bold" style={{ color: statusMeta.color }}>
            <span className="h-[7px] w-[7px] rounded-pill" style={{ background: statusMeta.color }} />
            {statusMeta.label}
          </span>
          <span className="text-xs text-ink-3">
            {words.toLocaleString("fr-FR")} mots · {Math.max(1, Math.round(words / 200))} min de lecture
          </span>
        </div>

        {/* toolbar : ajout de blocs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-line-2 px-5 py-2.5">
          {(Object.keys(BLOCK_LABEL) as BlockType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[7px] border border-line bg-surface-2 px-3 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
            >
              ＋ {BLOCK_LABEL[type]}
            </button>
          ))}
        </div>

        {/* zone d'écriture */}
        <div className="min-h-[520px] px-11 pb-12 pt-[34px]">
          <input
            value={article.kicker}
            onChange={(e) => set("kicker", e.target.value)}
            placeholder="Surtitre (ex. Enquête)"
            className="mb-3.5 w-full bg-transparent text-[11px] font-bold uppercase tracking-[0.1em] outline-none placeholder:text-ink-3"
            style={{ color: rubrique?.color }}
          />
          <textarea
            value={article.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Titre de l'article"
            rows={2}
            className="mb-4 w-full resize-none bg-transparent font-serif text-[26px] sm:text-[32px] lg:text-[38px] font-medium leading-[1.08] tracking-tight text-ink outline-none placeholder:text-ink-3"
          />
          <textarea
            value={article.dek}
            onChange={(e) => set("dek", e.target.value)}
            placeholder="Chapeau — deux phrases qui donnent envie de lire."
            rows={2}
            className="mb-7 w-full resize-none border-l-[3px] border-line bg-transparent pl-4 font-serif text-xl leading-[1.5] text-ink-2 outline-none placeholder:text-ink-3"
          />

          {article.blocks.map((block, i) => (
            <div key={i} className="group relative mb-4">
              <div className="absolute -right-2 top-0 hidden gap-1 group-hover:flex">
                <BlockBtn onClick={() => moveBlock(i, -1)} label="↑" />
                <BlockBtn onClick={() => moveBlock(i, 1)} label="↓" />
                <BlockBtn onClick={() => removeBlock(i)} label="✕" />
              </div>

              {block.type === "richtext" ? (
                <RichTextEditor value={block.html ?? ""} onChange={(html) => setBlock(i, { html })} />
              ) : block.type === "paragraph" ? (
                <AutoTextarea
                  value={block.text ?? ""}
                  onChange={(v) => setBlock(i, { text: v })}
                  placeholder="Paragraphe…"
                  className="w-full resize-none bg-transparent font-serif text-lg leading-[1.72] text-ink outline-none placeholder:text-ink-3"
                />
              ) : block.type === "h2" ? (
                <input
                  value={block.text ?? ""}
                  onChange={(e) => setBlock(i, { text: e.target.value })}
                  placeholder="Intertitre…"
                  className="w-full bg-transparent font-serif text-2xl font-semibold text-ink outline-none placeholder:text-ink-3"
                />
              ) : block.type === "quote" ? (
                <div className="border-l-[3px] border-orange pl-5">
                  <AutoTextarea
                    value={block.text ?? ""}
                    onChange={(v) => setBlock(i, { text: v })}
                    placeholder="« Citation… »"
                    className="w-full resize-none bg-transparent font-serif text-2xl font-medium italic leading-[1.35] text-ink outline-none placeholder:text-ink-3"
                  />
                  <input
                    value={block.cite ?? ""}
                    onChange={(e) => setBlock(i, { cite: e.target.value })}
                    placeholder="— Source de la citation"
                    className="mt-1 w-full bg-transparent text-[13px] text-ink-3 outline-none placeholder:text-ink-3"
                  />
                </div>
              ) : block.type === "callout" ? (
                <div
                  className="rounded-r-md border-l-4 bg-surface-2 p-4"
                  style={{ borderColor: CALLOUT_COLORS.find(([v]) => v === (block.variant ?? "orange"))![1] }}
                >
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Couleur :</span>
                    {CALLOUT_COLORS.map(([variant, color]) => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setBlock(i, { variant })}
                        title={variant}
                        className={`h-4 w-4 rounded-full border ${(block.variant ?? "orange") === variant ? "border-ink ring-1 ring-ink" : "border-line"}`}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <AutoTextarea
                    value={block.text ?? ""}
                    onChange={(v) => setBlock(i, { text: v })}
                    placeholder="Titre de l'encadré (1re ligne), puis contenu — une info par ligne…"
                    className="w-full resize-none bg-transparent font-serif text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
              ) : block.type === "kpi" ? (
                <div className="rounded-md bg-ink p-4">
                  <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#F5C24B]">
                    Barre de chiffres clés — une ligne « Libellé | Valeur »
                  </div>
                  <AutoTextarea
                    value={block.text ?? ""}
                    onChange={(v) => setBlock(i, { text: v })}
                    placeholder={"Taux national 2026 | 40,60 %\nAdmis | 122 360 / 301 364"}
                    className="w-full resize-none bg-transparent font-mono text-[13px] leading-relaxed text-white outline-none placeholder:text-white/40"
                  />
                </div>
              ) : block.type === "note" ? (
                <div className="rounded-md border border-dashed border-green bg-[rgba(0,102,51,0.05)] p-4">
                  <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-green">
                    Note de vérification des sources
                  </div>
                  <AutoTextarea
                    value={block.text ?? ""}
                    onChange={(v) => setBlock(i, { text: v })}
                    placeholder="Chiffres confirmés par l'AIP, Abidjan.net, RTI — multisources convergentes."
                    className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-[#2a5a2a] outline-none placeholder:text-ink-3"
                  />
                </div>
              ) : (
                <div className="rounded-[10px] border border-dashed border-line bg-surface-2 p-4">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                    Média (placeholder — médiathèque à venir)
                  </div>
                  <input
                    value={block.alt ?? ""}
                    onChange={(e) => setBlock(i, { alt: e.target.value, url: `placeholder://${e.target.value}` })}
                    placeholder="Légende du visuel…"
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ====== PANNEAU RÉGLAGES ====== */}
      <div className="flex flex-col gap-4 xl:sticky xl:top-[86px]">
        <Panel title="Publication">
          <div className="mb-3.5 flex items-center justify-between rounded-[8px] border border-line bg-surface-2 px-[13px] py-[9px]">
            <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold">
              <span className="h-[7px] w-[7px] rounded-pill" style={{ background: statusMeta.color }} />
              {statusMeta.label}
            </span>
          </div>

          <label className="flex items-center justify-between border-t border-line-2 py-2.5">
            <span>
              <span className="block text-[13px] font-semibold">Accès Premium A4A+</span>
              <span className="text-[11.5px] text-ink-3">Réservé aux abonnés</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={article.premium}
              onClick={() => set("premium", !article.premium)}
              className="relative h-[23px] w-10 rounded-pill transition-colors"
              style={{ background: article.premium ? "var(--green)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-[19px] w-[19px] rounded-pill bg-white transition-all"
                style={{ left: article.premium ? "auto" : 2, right: article.premium ? 2 : "auto" }}
              />
            </button>
          </label>

          <label className="flex items-center justify-between border-t border-line-2 py-2.5">
            <span>
              <span className="block text-[13px] font-semibold">Communiqué partenaire</span>
              <span className="text-[11.5px] text-ink-3">Article sponsorisé, signalé au lecteur</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={article.sponsored}
              onClick={() => set("sponsored", !article.sponsored)}
              className="relative h-[23px] w-10 rounded-pill transition-colors"
              style={{ background: article.sponsored ? "var(--orange, #E8641A)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-[19px] w-[19px] rounded-pill bg-white transition-all"
                style={{ left: article.sponsored ? "auto" : 2, right: article.sponsored ? 2 : "auto" }}
              />
            </button>
          </label>
          {article.sponsored ? (
            <input
              value={article.sponsorName}
              onChange={(e) => set("sponsorName", e.target.value)}
              maxLength={80}
              placeholder="Nom de l'annonceur (optionnel)"
              className="w-full rounded-[8px] border border-line bg-bg px-3 py-2 text-[13px]"
            />
          ) : null}

          <div className="border-t border-line-2 py-2.5">
            <span className="mb-1.5 block text-[13px] font-semibold">Programmer</span>
            <input
              type="datetime-local"
              value={article.scheduledAt ?? ""}
              onChange={(e) => set("scheduledAt", e.target.value || null)}
              className={inputCls}
            />
          </div>

          {message ? (
            <p
              className={`mb-2 rounded-[8px] px-3 py-2 text-[12.5px] font-semibold ${
                message.kind === "ok" ? "bg-[rgba(14,138,95,0.12)] text-green" : "bg-[rgba(214,40,45,0.1)] text-red"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          {article.slug ? (
            <a
              href={`/${rubrique?.slug ?? "article"}/${article.slug}`}
              target="_blank"
              rel="noreferrer"
              className="mb-2 block rounded-pill border border-line bg-surface-2 px-4 py-2 text-center text-[12.5px] font-semibold text-ink"
            >
              👁 Prévisualiser dans un onglet
            </a>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2.5">
            <ActionBtn onClick={() => run()} disabled={pending} variant="secondary">
              Enregistrer
            </ActionBtn>
            {article.status === "draft" ? (
              <ActionBtn onClick={() => run("submit_review")} disabled={pending} variant="secondary">
                Soumettre à révision
              </ActionBtn>
            ) : null}
            {(article.status === "review" || article.status === "scheduled") ? (
              <ActionBtn onClick={() => run("back_to_draft")} disabled={pending} variant="secondary">
                Repasser en brouillon
              </ActionBtn>
            ) : null}
            {canPublish && article.status !== "published" && article.scheduledAt ? (
              <ActionBtn onClick={() => run("schedule")} disabled={pending || !aUneVraieCouverture} variant="secondary">
                Programmer
              </ActionBtn>
            ) : null}
            {canPublish && article.status !== "published" ? (
              <ActionBtn onClick={() => run("publish")} disabled={pending || !aUneVraieCouverture} variant="primary">
                Publier
              </ActionBtn>
            ) : null}
            {canPublish && article.status !== "published" && !aUneVraieCouverture ? (
              <p className="mt-1 w-full text-[11.5px] font-semibold text-orange">
                ⚠ Ajoutez une image de couverture (panneau « Image à la une ») pour pouvoir publier.
              </p>
            ) : null}
            {canPublish && article.status === "published" ? (
              <ActionBtn onClick={() => run("unpublish")} disabled={pending} variant="secondary">
                Repasser en brouillon
              </ActionBtn>
            ) : null}
          </div>

          {/* Masquer / réafficher (rédaction en chef + admin) */}
          {canPublish && article.id && article.status === "published" ? (
            <label className="mt-3 flex items-center justify-between border-t border-line-2 pt-3">
              <span>
                <span className="block text-[13px] font-semibold">Masquer du public</span>
                <span className="text-[11.5px] text-ink-3">Reste consultable en aperçu</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={article.hidden}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await setArticleHidden(article.id!, !article.hidden);
                    if (r.ok) {
                      set("hidden", !article.hidden);
                      if (!article.hidden) set("featuredRank", null);
                    }
                    router.refresh();
                  })
                }
                className="relative h-[23px] w-10 rounded-pill transition-colors"
                style={{ background: article.hidden ? "var(--orange)" : "var(--line)" }}
              >
                <span
                  className="absolute top-0.5 h-[19px] w-[19px] rounded-pill bg-white transition-all"
                  style={{ left: article.hidden ? "auto" : 2, right: article.hidden ? 2 : "auto" }}
                />
              </button>
            </label>
          ) : null}
        </Panel>

        {/* Mise en Une : 5 positions, la n°1 = tête d'affiche de l'accueil */}
        {canPublish ? (
          <Panel title="À la Une">
            <p className="mb-2.5 text-[11.5px] text-ink-3">
              Position sur l&apos;accueil. La n°1 est la tête d&apos;affiche ; les positions 2 à 5 forment
              le bloc « À la une ».
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => set("featuredRank", null)}
                className={`rounded-pill px-3 py-1.5 text-[12px] font-semibold ${
                  article.featuredRank == null ? "bg-navy text-white" : "border border-line bg-surface-2 text-ink-2"
                }`}
              >
                Aucune
              </button>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("featuredRank", n)}
                  className={`h-8 w-8 rounded-pill text-[13px] font-bold ${
                    article.featuredRank === n ? "bg-orange text-white" : "border border-line bg-surface-2 text-ink-2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-ink-3">
              Une position déjà occupée est libérée automatiquement à l&apos;enregistrement.
            </p>
          </Panel>
        ) : null}

        <Panel title="Classement">
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Rubrique</label>
          <select
            value={article.rubriqueId}
            onChange={(e) => set("rubriqueId", e.target.value)}
            className={`${inputCls} mb-3.5`}
          >
            <option value="" disabled>
              Choisir une rubrique…
            </option>
            {rubriques.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Auteur</label>
          <div className="mb-3.5 rounded-[8px] border border-line bg-surface-2 px-[13px] py-2 text-[13px] font-semibold">
            {authorName}
          </div>

          <label className="mb-2 block text-xs font-semibold text-ink-2">Mots-clés</label>
          <div className="flex flex-wrap gap-[7px]">
            {article.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => set("tags", article.tags.filter((t) => t !== tag))}
                className="rounded-pill border border-line bg-surface-2 px-[11px] py-[5px] text-xs font-semibold text-ink-2"
                title="Retirer"
              >
                {tag} ✕
              </button>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  e.preventDefault();
                  if (!article.tags.includes(tagInput.trim())) set("tags", [...article.tags, tagInput.trim()]);
                  setTagInput("");
                }
              }}
              placeholder="＋ ajouter ⏎"
              className="w-24 rounded-pill border border-dashed border-line bg-transparent px-[11px] py-[5px] text-xs text-ink outline-none placeholder:text-ink-3"
            />
          </div>
        </Panel>

        <Panel title="Image à la une">
          {mediaOptions.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">
              Bibliothèque vide — ajoutez des visuels dans la Médiathèque.
            </p>
          ) : (
            (() => {
              // Filtre d'affichage seulement : `aUneVraieCouverture` reste calculé
              // sur la liste complète, la recherche ne doit pas bloquer la
              // publication d'un article dont la couverture est masquée par le filtre.
              const q = rechercheImage.trim().toLowerCase();
              const visibles = q
                ? mediaOptions.filter((m) => (m.alt ?? "").toLowerCase().includes(q) || m.url.toLowerCase().includes(q))
                : mediaOptions;
              return (
                <div>
                  <input
                    type="search"
                    value={rechercheImage}
                    onChange={(e) => setRechercheImage(e.target.value)}
                    placeholder={`Rechercher parmi ${mediaOptions.length} image${mediaOptions.length > 1 ? "s" : ""}…`}
                    className="mb-2 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[12.5px] outline-none focus:border-ink-3"
                  />
                  {/* Zone défilante : toute la médiathèque est accessible, plus
                      de plafond à 23 visuels. */}
                  <div className="max-h-[300px] overflow-y-auto rounded-[8px] border border-line-2 p-2">
                    <div className="grid grid-cols-3 gap-2">
                      {!q ? (
                        <button
                          type="button"
                          onClick={() => set("coverAssetId", null)}
                          className={`flex h-16 items-center justify-center rounded-[8px] border text-[11px] font-semibold ${
                            article.coverAssetId === null ? "border-ink text-ink" : "border-line text-ink-3"
                          }`}
                        >
                          Aucune
                        </button>
                      ) : null}
                      {visibles.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          title={m.alt ?? undefined}
                          onClick={() => set("coverAssetId", m.id)}
                          className={`h-16 overflow-hidden rounded-[8px] border-2 ${
                            article.coverAssetId === m.id ? "border-[var(--accent)]" : "border-transparent"
                          }`}
                        >
                          {m.url.startsWith("placeholder://") ? (
                            <span className="flex h-full w-full items-center justify-center bg-surface-2 px-1 text-center font-mono text-[9px] uppercase text-ink-3">
                              {m.url.slice("placeholder://".length).slice(0, 24)}
                            </span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                    {visibles.length === 0 ? (
                      <p className="py-4 text-center text-[12px] text-ink-3">Aucune image ne correspond à « {rechercheImage} ».</p>
                    ) : null}
                  </div>
                </div>
              );
            })()
          )}
        </Panel>

        <Panel title="Référencement">
          <div className="text-xs text-ink-3">Slug</div>
          <div className="mb-3 mt-1 break-all rounded-[7px] border border-line bg-surface-2 px-[11px] py-2 text-[12.5px] text-ink-2">
            /{rubrique?.slug ?? "rubrique"}/{article.slug ?? "généré à l'enregistrement"}
          </div>
          <div className="rounded-[9px] border border-line-2 bg-surface-2 px-3.5 py-3">
            <div className="mb-0.5 text-xs text-[#1a6ed8]">abidjan4all.net › {rubrique?.slug ?? "…"}</div>
            <div className="text-sm font-semibold leading-[1.2] text-[#1a3ca8]">
              {article.title || "Titre de l'article"}
            </div>
            <div className="mt-[3px] text-[11.5px] leading-[1.35] text-ink-3">
              {(article.dek || "Le chapeau sert de méta-description.").slice(0, 140)}
              {(article.dek?.length ?? 0) > 140 ? "…" : ""}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-5 py-[18px] shadow-[var(--shadow-sm)]">
      <div className="mb-3.5 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{title}</div>
      {children}
    </div>
  );
}

function BlockBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-line bg-surface text-xs text-ink-3 hover:text-ink"
    >
      {label}
    </button>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  variant: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-pill px-4 py-[11px] text-[13px] disabled:opacity-60 ${
        variant === "primary"
          ? "flex-[1.4] bg-red font-bold text-white"
          : "flex-1 border border-line bg-surface-2 font-semibold text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** textarea qui grandit avec le contenu (zone d'écriture). */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      ref={(el) => {
        if (el) {
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }
      }}
      rows={2}
      placeholder={placeholder}
      className={className}
    />
  );
}
