"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArticleStatus } from "@a4a/db";
import { saveArticle, setArticleHidden, transitionArticle, type ArticleInput } from "@/lib/actions/article-actions";
import {
  cleBrouillon,
  lireBrouillon,
  oublierBrouillon,
  useGardeModifications,
  type BrouillonLocal,
} from "./garde-modifications";
import { ImportHtml } from "./import-html";
import { RichTextEditor } from "./rich-text-editor";
import { SelecteurImage } from "./selecteur-image";
import { STATUS_META } from "./status-chip";

/**
 * Domaine affiché dans l'aperçu de référencement. Il suit la même variable que
 * les URL canoniques : un domaine écrit en dur finit par mentir le jour où le
 * site change d'adresse — ce qui est arrivé avec abidjan4all.net.
 */
const DOMAINE_SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://abidjan4all.info")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

type BlockType = "paragraph" | "richtext" | "h2" | "quote" | "callout" | "image" | "kpi" | "note";
type CalloutVariant = "orange" | "blue" | "teal" | "red" | "green" | "purple";
type Block = {
  type: BlockType;
  text?: string;
  html?: string;
  cite?: string;
  url?: string;
  /** Texte alternatif : décrit l'image pour qui ne la voit pas. Jamais affiché. */
  alt?: string;
  /** Légende éditoriale, affichée sous l'image dans l'article. */
  caption?: string;
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
  /** Légende de l'image de une, saisie pour cet article. */
  coverCaption: string;
  featuredRank: number | null;
  hidden: boolean;
  slug: string | null;
  blocks: Block[];
  /** Signataire de l'article — modifiable par la rédaction en chef seule. */
  authorId: string;
};

export type RubriqueOption = { id: string; slug: string; name: string; color: string };
export type AuteurOption = { id: string; name: string; role: string };
export type MediaOption = { id: string; url: string; alt: string | null };

/**
 * Blocs proposés à la création.
 *
 * « Texte enrichi » n'y figure plus. Il n'avait qu'une raison d'être : porter
 * une mise en forme que le paragraphe ne savait pas porter. Le paragraphe la
 * porte désormais, avec la même barre d'outils et le même stockage — les deux
 * faisaient double emploi, et proposer deux blocs pour un même travail oblige
 * le rédacteur à trancher une question qui n'a pas de réponse.
 *
 * Le TYPE, lui, reste pris en charge : sept articles en contiennent, ils
 * s'affichent et se modifient comme avant. On retire le bloc du catalogue, on
 * n'efface pas ce qui existe.
 */
const BLOCK_LABEL: Record<Exclude<BlockType, "richtext">, string> = {
  paragraph: "Paragraphe",
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
  auteurs = [],
  motsCles = [],
}: {
  initial: EditorArticle;
  rubriques: RubriqueOption[];
  canPublish: boolean;
  authorName: string;
  mediaOptions?: MediaOption[];
  /** Signataires possibles — fourni seulement à la rédaction en chef. */
  auteurs?: AuteurOption[];
  /** Mots-clés déjà employés sur le site, proposés à la saisie. */
  motsCles?: string[];
}) {
  const router = useRouter();
  const [article, setArticle] = useState(initial);
  const [tagInput, setTagInput] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Référence de comparaison : l'état tel qu'il est en base. Remis à jour après
  // chaque enregistrement, sans quoi l'éditeur se croirait modifié pour
  // toujours et avertirait à tort.
  const [enregistre, setEnregistre] = useState(() => JSON.stringify(initial));
  const modifie = JSON.stringify(article) !== enregistre;

  const cle = cleBrouillon(initial.id);
  useGardeModifications(modifie, article, cle);

  // Reprise d'un brouillon local laissé par une session interrompue. Proposée,
  // jamais imposée : la copie locale peut être plus ancienne que la base si
  // l'article a été repris ailleurs entre-temps, et c'est au rédacteur de
  // savoir laquelle des deux versions est la sienne.
  const [reprise, setReprise] = useState<BrouillonLocal<EditorArticle> | null>(null);
  useEffect(() => {
    const copie = lireBrouillon<EditorArticle>(cle);
    if (copie && JSON.stringify(copie.valeur) !== JSON.stringify(initial)) setReprise(copie);
    // Au montage seulement : une fois la question posée, elle ne se repose pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      coverCaption: article.coverCaption.trim() || null,
      featuredRank: article.featuredRank,
      blocks: article.blocks,
      // Toujours transmis ; le serveur l'ignore si le rôle ne permet pas de
      // changer la signature (cf. saveArticle).
      authorId: article.authorId,
    };
  }

  function run(action?: Parameters<typeof transitionArticle>[1]) {
    setMessage(null);
    startTransition(async () => {
      const saved = await saveArticle(toInput());
      if (!saved.ok) return setMessage({ kind: "error", text: saved.error });
      const id = saved.id;
      // L'état réellement en base à l'issue de l'opération. Construit ici, et
      // non lu depuis `article` : celui-ci appartient au rendu en cours et
      // ignorera le changement de statut ci-dessous, si bien que la garde
      // croirait l'article encore modifié juste après l'avoir publié.
      let apres: EditorArticle = { ...article, id };
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
        apres = { ...apres, status: nextStatus[action] };
      }
      // Un seul point d'application : l'éditeur adopte l'état d'après, garde
      // comprise. Poser le statut sans l'identifiant laissait un écart d'un
      // champ — assez pour qu'un article tout juste créé se déclare modifié.
      setArticle(apres);
      setMessage({ kind: "ok", text: action ? "Statut mis à jour." : "Enregistré." });

      // Le travail est en base : la garde n'a plus rien à protéger, et la copie
      // locale n'a plus de raison d'être.
      setEnregistre(JSON.stringify(apres));
      oublierBrouillon(cle);

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
        {/* Brouillon retrouvé : une session s'est interrompue sans enregistrer. */}
        {reprise ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F47920] bg-[rgba(244,121,32,0.08)] px-[22px] py-3">
            <span className="text-[13px] text-ink">
              <strong className="font-bold">Brouillon non enregistré retrouvé</strong> — laissé le{" "}
              {new Date(reprise.enregistreLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setArticle(reprise.valeur);
                  setReprise(null);
                }}
                className="rounded-pill bg-[#F47920] px-[14px] py-1.5 text-[12.5px] font-bold text-white"
              >
                Reprendre
              </button>
              <button
                type="button"
                onClick={() => {
                  oublierBrouillon(cle);
                  setReprise(null);
                }}
                className="rounded-pill border border-line px-[14px] py-1.5 text-[12.5px] font-semibold text-ink-2"
              >
                Ignorer
              </button>
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-b border-line-2 bg-surface-2 px-[22px] py-3">
          <span className="inline-flex items-center gap-[7px] text-xs font-bold" style={{ color: statusMeta.color }}>
            <span className="h-[7px] w-[7px] rounded-pill" style={{ background: statusMeta.color }} />
            {statusMeta.label}
          </span>
          <span className="flex items-center gap-3 text-xs text-ink-3">
            {/* Dire l'état plutôt que de le laisser deviner : l'avertissement au
                départ ne doit jamais être la première nouvelle. */}
            {modifie ? <span className="font-semibold text-[#F47920]">● Modifications non enregistrées</span> : null}
            <span>
              {words.toLocaleString("fr-FR")} mots · {Math.max(1, Math.round(words / 200))} min de lecture
            </span>
          </span>
        </div>

        {/* toolbar : ajout de blocs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-line-2 px-5 py-2.5">
          {(Object.keys(BLOCK_LABEL) as Exclude<BlockType, "richtext">[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[7px] border border-line bg-surface-2 px-3 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
            >
              ＋ {BLOCK_LABEL[type]}
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {/* Reprendre un texte déjà mis en forme ailleurs, sans le ressaisir.
              Placé avec les blocs parce que c'est bien de contenu qu'il s'agit :
              l'import en produit, il ne fait pas autre chose. */}
          <ImportHtml
            corpsVide={article.blocks.every((b) => !(b.text ?? b.html ?? "").trim())}
            onInserer={(importes, remplacer) =>
              setArticle((a) => {
                // Les blocs importés portent les mêmes types que ceux de
                // l'éditeur : ils entrent tels quels, aucune traduction n'est
                // nécessaire au passage.
                const arrivants = importes as Block[];
                // « Ajouter à la suite » sur un corps vide laisserait un
                // paragraphe vide en tête, celui qu'on crée à l'ouverture.
                const existants = remplacer
                  ? []
                  : a.blocks.filter((b) => (b.text ?? b.html ?? b.url ?? "").trim().length > 0);
                return { ...a, blocks: [...existants, ...arrivants] };
              })
            }
          />
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
              {/* Les commandes du bloc passent devant tout le reste : la barre
                  de mise en forme se déploie au même endroit et les couvrait,
                  faute de couche. La barre, elle, se garde libre le coin
                  haut-droit (`reserveDroite`) pour qu'aucun de ses boutons ne
                  finisse dessous. */}
              <div className="absolute -right-2 top-0 z-20 hidden gap-1 group-hover:flex">
                <BlockBtn onClick={() => moveBlock(i, -1)} label="↑" />
                <BlockBtn onClick={() => moveBlock(i, 1)} label="↓" />
                <BlockBtn onClick={() => removeBlock(i)} label="✕" />
              </div>

              {block.type === "richtext" ? (
                <RichTextEditor reserveDroite value={block.html ?? ""} onChange={(html) => setBlock(i, { html })} />
              ) : block.type === "paragraph" ? (
                <RichTextEditor
                  compact
                  reserveDroite
                  placeholder="Paragraphe…"
                  // Un paragraphe d'avant la mise en forme ne porte que du
                  // texte : on l'échappe pour l'ouvrir en HTML, sinon un
                  // chevron ou une esperluette du texte d'origine serait pris
                  // pour du balisage. Les archives en contiennent.
                  value={block.html ?? echapperHtml(block.text ?? "")}
                  // Le texte nu est conservé À CÔTÉ du HTML, et ce n'est pas
                  // une redondance : l'index de recherche du site lit le champ
                  // `text` des blocs. Un paragraphe qui ne porterait que du
                  // HTML sortirait des résultats de recherche.
                  onChange={(html, texte) => setBlock(i, { html, text: texte })}
                  className="prose-editor w-full bg-transparent font-serif text-lg leading-[1.72] text-ink outline-none [&_a]:text-blue [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
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
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2">
                    Média
                  </div>
                  {block.url && !block.url.startsWith("placeholder://") ? (
                    <div className="mb-2.5 overflow-hidden rounded-[8px] border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={block.url} alt={block.alt ?? ""} className="h-40 w-full object-cover" />
                    </div>
                  ) : null}
                  {/* Légende et texte alternatif sont deux choses différentes,
                      et partageaient jusqu'ici le même champ. La légende se lit
                      sous la photo dans l'article ; le texte alternatif ne
                      s'adresse qu'aux lecteurs d'écran. Les confondre revenait
                      à publier sous les images un texte écrit pour les
                      malvoyants — ou l'inverse. */}
                  <input
                    value={block.caption ?? ""}
                    onChange={(e) =>
                      setBlock(i, {
                        caption: e.target.value,
                        // Tant qu'aucun visuel n'est choisi, la légende tient
                        // lieu de placeholder — le comportement d'avant, qui
                        // permet de poser un emplacement à illustrer plus tard.
                        ...(block.url && !block.url.startsWith("placeholder://")
                          ? {}
                          : { url: `placeholder://${e.target.value}` }),
                      })
                    }
                    placeholder="Légende affichée sous l'image…"
                    className={inputCls}
                  />
                  <input
                    value={block.alt ?? ""}
                    onChange={(e) => setBlock(i, { alt: e.target.value })}
                    placeholder="Texte alternatif (accessibilité, non affiché)…"
                    className={`${inputCls} mt-2`}
                  />
                  <div className="mt-2.5">
                    {mediaOptions.length === 0 ? (
                      <p className="text-[12.5px] text-ink-2">
                        Bibliothèque vide — ajoutez des visuels dans la Médiathèque.
                      </p>
                    ) : (
                      <SelecteurImage
                        medias={mediaOptions}
                        estChoisi={(m) => block.url === m.url}
                        onChoisir={(m) =>
                          // Le libellé du média ne sert plus de légende par
                          // défaut : c'est un nom de classement
                          // (« photo-ministre-2 »), écrit pour retrouver un
                          // fichier, et la même image sert plusieurs articles.
                          // Il alimente le texte alternatif, son usage légitime,
                          // et seulement si rien n'y a été saisi.
                          setBlock(i, { url: m?.url, alt: block.alt || m?.alt || "" })
                        }
                      />
                    )}
                  </div>
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
          {canPublish && auteurs.length > 0 ? (
            <>
              <select
                value={article.authorId}
                onChange={(e) => set("authorId", e.target.value)}
                className={`${inputCls} mb-1`}
              >
                {/* L'auteur courant figure toujours dans la liste, même s'il a
                    quitté la rédaction : sinon le sélecteur afficherait
                    quelqu'un d'autre et la signature changerait sans qu'on l'ait
                    demandé, au premier enregistrement venu. */}
                {auteurs.some((a) => a.id === article.authorId) ? null : (
                  <option value={article.authorId}>{authorName}</option>
                )}
                {auteurs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="mb-3.5 text-[11.5px] text-ink-2">
                Modifiable même après publication — le changement prend effet à l&apos;enregistrement.
              </p>
            </>
          ) : (
            <div className="mb-3.5 rounded-[8px] border border-line bg-surface-2 px-[13px] py-2 text-[13px] font-semibold">
              {authorName}
            </div>
          )}

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
              list="a4a-mots-cles"
              className="w-24 rounded-pill border border-dashed border-line bg-transparent px-[11px] py-[5px] text-xs text-ink outline-none placeholder:text-ink-3"
            />
            {/* Suggestions natives : le navigateur filtre à la frappe et reste
                utilisable au clavier. Elles évitent que « Côte d'Ivoire »,
                « Cote d'Ivoire » et « côte d'ivoire » vivent chacune leur vie —
                trois mots-clés là où le lecteur en attend un. */}
            <datalist id="a4a-mots-cles">
              {motsCles.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          {motsCles.length > 0 ? (
            <p className="mt-2 text-[11.5px] text-ink-2">
              {motsCles.length} mots-clés déjà employés vous sont proposés à la saisie.
            </p>
          ) : null}
        </Panel>

        <Panel title="Image à la une">
          {mediaOptions.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">
              Bibliothèque vide — ajoutez des visuels dans la Médiathèque.
            </p>
          ) : (
            <SelecteurImage
              medias={mediaOptions}
              autoriserAucune
              estChoisi={(m) => article.coverAssetId === m.id}
              onChoisir={(m) => set("coverAssetId", m?.id ?? null)}
            />
          )}
          {/* La page article affichait ici le libellé du média dans la
              médiathèque, un nom de classement lu par les visiteurs faute de
              mieux. La légende s'écrit désormais pour l'article : laissée
              vide, aucune n'est affichée. */}
          <input
            value={article.coverCaption}
            onChange={(e) => set("coverCaption", e.target.value)}
            placeholder="Légende affichée sous la photo…"
            className={`${inputCls} mt-3`}
            aria-label="Légende de l'image à la une"
          />
          <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">
            Le crédit photo reste géré dans la Médiathèque et s&apos;affiche à la suite.
          </p>
        </Panel>

        <Panel title="Référencement">
          <div className="text-xs text-ink-3">Slug</div>
          <div className="mb-3 mt-1 break-all rounded-[7px] border border-line bg-surface-2 px-[11px] py-2 text-[12.5px] text-ink-2">
            /{rubrique?.slug ?? "rubrique"}/{article.slug ?? "généré à l'enregistrement"}
          </div>
          <div className="rounded-[9px] border border-line-2 bg-surface-2 px-3.5 py-3">
            <div className="mb-0.5 text-xs text-[#1a6ed8]">{DOMAINE_SITE} › {rubrique?.slug ?? "…"}</div>
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

/**
 * Échappe un texte nu pour l'ouvrir dans un éditeur HTML.
 *
 * Les paragraphes écrits avant la mise en forme ne portent que du texte. Sans
 * cet échappement, un chevron ou une esperluette y serait relu comme du
 * balisage — les archives d'abidjan4all.net en contiennent.
 */
function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}
