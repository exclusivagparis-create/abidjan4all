"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusChip } from "@/components/admin/status-chip";

/**
 * Tableau des articles avec sélection multiple et suppression par lot.
 *
 * La ligne entière reste cliquable — c'est le comportement auquel la rédaction
 * est habituée. Le procédé est le « lien étiré » : le titre porte un
 * pseudo-élément qui recouvre la ligne, et la case à cocher passe au-dessus.
 * Imbriquer une case dans un lien, l'autre solution évidente, produit un HTML
 * invalide et un clic qui se dispute entre les deux.
 */

export interface LigneArticle {
  id: string;
  slug: string;
  titre: string;
  rubriqueNom: string;
  rubriqueCouleur: string;
  auteur: string;
  initiales: string;
  statut: "draft" | "review" | "scheduled" | "published";
  dateLabel: string;
  vuesLabel: string;
  featuredRank: number | null;
  masque: boolean;
  /** En mode doublons : 1 = exemplaire conservé, au-delà = copie. Sinon null. */
  rangDoublon: number | null;
  /** Nombre d'exemplaires portant ce titre. */
  tailleGroupe: number | null;
}

/** Par paquets côté navigateur : la progression est réelle, et aucune requête
 *  ne devient assez longue pour expirer. */
const PAQUET = 100;

const GRILLE = "grid grid-cols-[34px_1fr_130px_150px_110px_110px_70px] min-w-[920px] gap-4";

export function ArticlesSelection({
  lignes,
  peutSupprimer,
  totalFiltre,
  filtres,
}: {
  lignes: LigneArticle[];
  peutSupprimer: boolean;
  /** Nombre d'articles répondant au filtre courant, toutes pages confondues. */
  totalFiltre: number;
  /**
   * Filtre courant, reconduit tel quel vers l'API pour élargir la sélection.
   * Toute clé présente est transmise : ajouter un filtre à la page suffit donc
   * à ce que la sélection « tout le filtre » en tienne compte — sans quoi elle
   * porterait sur des articles absents de l'écran.
   */
  filtres: { statut?: string; q?: string; rubrique?: string; auteur?: string; du?: string; au?: string };
}) {
  // En mode doublons, « cocher la page » ne doit prendre que les copies : la
  // case d'en-tête cocherait sinon aussi les exemplaires à conserver, et une
  // suppression ferait disparaître les articles au lieu de les dédoublonner.
  const modeDoublons = filtres.statut === "doublons";
  const router = useRouter();
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [elargissement, setElargissement] = useState(false);
  const [tronque, setTronque] = useState(false);
  const [modale, setModale] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [traites, setTraites] = useState(0);
  const [bilan, setBilan] = useState<{ ton: "ok" | "partiel" | "erreur"; texte: string } | null>(null);
  const caseEntete = useRef<HTMLInputElement>(null);

  const surLaPage = useMemo(
    () => lignes.filter((l) => !modeDoublons || l.rangDoublon !== 1).map((l) => l.slug),
    [lignes, modeDoublons]
  );
  const tousCoches = surLaPage.length > 0 && surLaPage.every((s) => choisis.has(s));
  const partiel = surLaPage.some((s) => choisis.has(s)) && !tousCoches;

  // L'état « partiellement coché » n'existe pas en HTML : il se pose en JS.
  useEffect(() => {
    if (caseEntete.current) caseEntete.current.indeterminate = partiel;
  }, [partiel]);

  /**
   * Décompte des articles en ligne dans la sélection. Tant qu'on coche à la
   * main, la page suffit ; dès que la sélection déborde la page, seul le
   * serveur sait ce qu'elle contient — sinon l'avertissement annoncerait zéro
   * publié en s'apprêtant à en supprimer trente.
   */
  const [sensiblesServeur, setSensiblesServeur] = useState<{ publies: number; programmes: number } | null>(null);
  const sensibles = useMemo(() => {
    if (sensiblesServeur) return sensiblesServeur;
    const dedans = lignes.filter((l) => choisis.has(l.slug));
    return {
      publies: dedans.filter((l) => l.statut === "published").length,
      programmes: dedans.filter((l) => l.statut === "scheduled").length,
    };
  }, [lignes, choisis, sensiblesServeur]);

  const nb = choisis.size;
  const exigeSaisie = nb > 100;
  const peutValider = !enCours && (!exigeSaisie || saisie.trim().toUpperCase() === "SUPPRIMER");

  /** Toute retouche manuelle périme le décompte venu du serveur. */
  function oublierDecompteServeur() {
    setSensiblesServeur(null);
    setTronque(false);
  }

  function basculer(slug: string) {
    oublierDecompteServeur();
    setChoisis((prec) => {
      const s = new Set(prec);
      s.has(slug) ? s.delete(slug) : s.add(slug);
      return s;
    });
  }

  function basculerPage() {
    oublierDecompteServeur();
    setChoisis((prec) => {
      const s = new Set(prec);
      if (tousCoches) surLaPage.forEach((x) => s.delete(x));
      else surLaPage.forEach((x) => s.add(x));
      return s;
    });
  }

  /**
   * Étend la sélection à tous les articles du filtre, au-delà de la page
   * affichée. Les slugs sont demandés au serveur : c'est lui qui sait ce que
   * recouvre le filtre, et l'API de suppression n'accepte que des slugs — elle
   * ne prend jamais un filtre, dont une erreur effacerait tout d'un coup.
   */
  async function elargirAuFiltre() {
    setElargissement(true);
    try {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(filtres)) if (v) p.set(k, v);
      const r = await fetch(`/api/v1/articles/slugs?${p}`);
      if (!r.ok) throw new Error(`Le serveur a répondu ${r.status}.`);
      const data = (await r.json()) as {
        slugs: string[];
        total: number;
        tronque: boolean;
        publies: number;
        programmes: number;
      };
      setChoisis(new Set(data.slugs));
      setTronque(data.tronque);
      setSensiblesServeur({ publies: data.publies, programmes: data.programmes });
    } catch (e) {
      setBilan({ ton: "erreur", texte: e instanceof Error ? e.message : "Sélection élargie impossible." });
    } finally {
      setElargissement(false);
    }
  }

  async function supprimer() {
    setEnCours(true);
    setTraites(0);
    const slugs = [...choisis];
    let supprimes = 0;
    const echecs: { slug: string; raison: string }[] = [];

    try {
      for (let i = 0; i < slugs.length; i += PAQUET) {
        const paquet = slugs.slice(i, i + PAQUET);
        const r = await fetch("/api/v1/articles/bulk", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slugs: paquet }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => null);
          throw new Error(err?.error?.message ?? `Le serveur a répondu ${r.status}.`);
        }
        const data = (await r.json()) as { deleted: number; errors: { slug: string; raison: string }[] };
        supprimes += data.deleted;
        echecs.push(...data.errors);
        setTraites(Math.min(i + PAQUET, slugs.length));
      }

      setBilan(
        echecs.length === 0
          ? { ton: "ok", texte: `${supprimes} article${supprimes > 1 ? "s" : ""} supprimé${supprimes > 1 ? "s" : ""}.` }
          : {
              ton: "partiel",
              texte: `${supprimes} supprimé${supprimes > 1 ? "s" : ""}, ${echecs.length} en échec : ${echecs
                .slice(0, 3)
                .map((e) => e.slug)
                .join(", ")}${echecs.length > 3 ? "…" : ""}`,
            }
      );
      setChoisis(new Set());
      oublierDecompteServeur();
      setModale(false);
      setSaisie("");
      router.refresh();
    } catch (e) {
      setBilan({ ton: "erreur", texte: e instanceof Error ? e.message : "La suppression a échoué." });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      {bilan ? (
        <p
          role="status"
          aria-live="polite"
          className={`mb-3 rounded-[8px] px-4 py-3 text-[13px] font-semibold ${
            bilan.ton === "ok"
              ? "bg-[rgba(46,139,87,0.1)] text-green"
              : bilan.ton === "partiel"
                ? "bg-[rgba(232,100,26,0.1)] text-orange"
                : "bg-[rgba(214,40,45,0.1)] text-red"
          }`}
        >
          {bilan.texte}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div
          className={`${GRILLE} border-b border-line bg-surface-2 px-[22px] py-[13px] text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3`}
        >
          <span className="flex items-center">
            {peutSupprimer ? (
              <input
                ref={caseEntete}
                type="checkbox"
                checked={tousCoches}
                onChange={basculerPage}
                aria-label={modeDoublons ? "Sélectionner les copies de cette page" : "Tout sélectionner sur cette page"}
                className="h-[15px] w-[15px] cursor-pointer accent-[var(--red)]"
              />
            ) : null}
          </span>
          <span>Titre</span>
          <span>Rubrique</span>
          <span>Auteur</span>
          <span>Statut</span>
          <span>Date</span>
          <span className="text-right">Vues</span>
        </div>

        {lignes.map((a) => {
          const coche = choisis.has(a.slug);
          return (
            <div
              key={a.id}
              className={`${GRILLE} relative items-center border-b border-line-2 px-[22px] py-[15px] last:border-b-0 ${
                coche ? "bg-[rgba(214,40,45,0.05)]" : "hover:bg-surface-2/60"
              }`}
            >
              <span className="flex items-center">
                {peutSupprimer ? (
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() => basculer(a.slug)}
                    aria-label={`Sélectionner « ${a.titre} »`}
                    className="relative z-10 h-[15px] w-[15px] cursor-pointer accent-[var(--red)]"
                  />
                ) : null}
              </span>

              <Link
                href={`/admin/articles/${a.id}`}
                className="font-serif text-base font-semibold leading-[1.2] after:absolute after:inset-0 after:content-['']"
              >
                {a.featuredRank ? (
                  <span className="mr-1.5 rounded bg-orange px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">
                    UNE {a.featuredRank}
                  </span>
                ) : null}
                {a.masque ? (
                  <span className="mr-1.5 rounded bg-ink-3 px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">
                    MASQUÉ
                  </span>
                ) : null}
                {/* En mode doublons, dire lequel survit à un nettoyage : sans
                    cette marque, rien ne distingue à l'œil l'exemplaire gardé
                    des copies, et la sélection intelligente paraîtrait
                    arbitraire. */}
                {a.rangDoublon === 1 ? (
                  <span className="mr-1.5 rounded bg-green px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">
                    À CONSERVER
                  </span>
                ) : a.rangDoublon ? (
                  <span className="mr-1.5 rounded bg-orange px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">
                    COPIE {a.rangDoublon} / {a.tailleGroupe}
                  </span>
                ) : null}
                {a.titre}
              </Link>

              <span
                className="justify-self-start rounded-pill px-[9px] py-[3px] text-[10.5px] font-bold uppercase"
                style={{
                  color: a.rubriqueCouleur,
                  background: `color-mix(in srgb, ${a.rubriqueCouleur} 12%, transparent)`,
                }}
              >
                {a.rubriqueNom.split(" ")[0]}
              </span>
              <span className="flex items-center gap-2">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-pill bg-[linear-gradient(135deg,#E8641A,#D6282D)] text-[11px] font-bold text-white">
                  {a.initiales}
                </span>
                <span className="text-[12.5px] text-ink-2">{a.auteur}</span>
              </span>
              <StatusChip status={a.statut} />
              <span className="text-[12.5px] text-ink-3">{a.dateLabel}</span>
              <span className="text-right text-[12.5px] font-bold text-ink-2">{a.vuesLabel}</span>
            </div>
          );
        })}

        {lignes.length === 0 ? (
          <p className="px-[22px] py-8 text-center text-[13px] text-ink-3">Aucun article dans ce statut.</p>
        ) : null}
      </div>

      {/* Bandeau de sélection — fixé en bas, pour rester atteignable quel que
          soit le défilement dans une liste de plusieurs milliers de lignes. */}
      {peutSupprimer && nb > 0 ? (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-navy px-5 py-3.5 shadow-[var(--shadow-md)]">
          <span className="text-[13.5px] font-semibold text-white">
            {nb} article{nb > 1 ? "s" : ""} sélectionné{nb > 1 ? "s" : ""}
          </span>
          {sensibles.publies + sensibles.programmes > 0 ? (
            <span className="rounded-pill bg-[rgba(232,100,26,0.2)] px-2.5 py-1 text-[11.5px] font-bold text-orange">
              dont {sensibles.publies} publié{sensibles.publies > 1 ? "s" : ""}
              {sensibles.programmes > 0 ? ` et ${sensibles.programmes} programmé${sensibles.programmes > 1 ? "s" : ""}` : ""}
            </span>
          ) : null}
          {/* Toute la page est cochée mais le filtre en contient davantage :
              c'est le seul moment où proposer d'élargir a du sens. Sans cette
              porte, apurer six mille brouillons se ferait cinquante par
              cinquante. */}
          {tousCoches && nb < totalFiltre ? (
            <button
              type="button"
              onClick={elargirAuFiltre}
              disabled={elargissement}
              className="rounded-pill border border-white/25 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              {elargissement
                ? "Sélection…"
                : modeDoublons
                  ? `Sélectionner les ${totalFiltre.toLocaleString("fr-FR")} copies excédentaires`
                  : `Sélectionner les ${totalFiltre.toLocaleString("fr-FR")} articles du filtre`}
            </button>
          ) : null}

          {tronque ? (
            <span className="text-[11.5px] text-[#9AA4BA]">
              plafonné à 1 000 par opération — recommencez pour le reste
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setChoisis(new Set());
              oublierDecompteServeur();
            }}
            className="ml-auto text-[12.5px] font-semibold text-[#9AA4BA] hover:text-white"
          >
            Tout désélectionner
          </button>
          <button
            type="button"
            onClick={() => {
              setBilan(null);
              setModale(true);
            }}
            className="rounded-pill bg-red px-5 py-2 text-[13px] font-bold text-white"
          >
            Supprimer la sélection
          </button>
        </div>
      ) : null}

      {modale ? (
        <ModaleConfirmation
          nb={nb}
          sensibles={sensibles}
          exigeSaisie={exigeSaisie}
          saisie={saisie}
          setSaisie={setSaisie}
          peutValider={peutValider}
          enCours={enCours}
          progression={enCours ? Math.round((traites / Math.max(1, nb)) * 100) : 0}
          onAnnuler={() => {
            if (enCours) return;
            setModale(false);
            setSaisie("");
          }}
          onValider={supprimer}
        />
      ) : null}
    </>
  );
}

function ModaleConfirmation({
  nb,
  sensibles,
  exigeSaisie,
  saisie,
  setSaisie,
  peutValider,
  enCours,
  progression,
  onAnnuler,
  onValider,
}: {
  nb: number;
  sensibles: { publies: number; programmes: number };
  exigeSaisie: boolean;
  saisie: string;
  setSaisie: (v: string) => void;
  peutValider: boolean;
  enCours: boolean;
  progression: number;
  onAnnuler: () => void;
  onValider: () => void;
}) {
  // Échap ferme, comme dans toute boîte de dialogue.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onAnnuler();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onAnnuler]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-suppression"
      onClick={onAnnuler}
    >
      <div
        className="w-full max-w-[460px] rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titre-suppression" className="mb-2 font-serif text-[21px] font-semibold text-ink">
          Confirmer la suppression
        </h2>
        <p className="mb-4 text-[13.5px] leading-[1.6] text-ink-2">
          Vous êtes sur le point de supprimer définitivement <b>{nb}</b> article{nb > 1 ? "s" : ""}. Cette
          action est irréversible depuis le Studio.
        </p>

        {sensibles.publies + sensibles.programmes > 0 ? (
          <p className="mb-4 rounded-[8px] bg-[rgba(232,100,26,0.1)] px-4 py-3 text-[12.5px] font-semibold leading-[1.55] text-orange">
            {sensibles.publies > 0 ? (
              <>
                {sensibles.publies} article{sensibles.publies > 1 ? "s" : ""} de cette sélection {sensibles.publies > 1 ? "sont" : "est"} en
                ligne. {sensibles.publies > 1 ? "Leurs adresses deviendront" : "Son adresse deviendra"} introuvable
                {sensibles.publies > 1 ? "s" : ""} pour vos lecteurs et pour les moteurs de recherche.
              </>
            ) : null}
            {sensibles.programmes > 0 ? (
              <> {sensibles.programmes} publication{sensibles.programmes > 1 ? "s" : ""} programmée{sensibles.programmes > 1 ? "s" : ""} {sensibles.programmes > 1 ? "n'auront" : "n'aura"} pas lieu.</>
            ) : null}
          </p>
        ) : null}

        {exigeSaisie ? (
          <label className="mb-4 grid gap-1.5 text-xs font-semibold text-ink-2">
            Au-delà de cent articles, tapez <b className="text-ink">SUPPRIMER</b> pour confirmer
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoFocus
              disabled={enCours}
              className="rounded-[8px] border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3"
            />
          </label>
        ) : null}

        {enCours ? (
          <div className="mb-4">
            <div className="mb-1.5 flex justify-between text-[12px] text-ink-3">
              <span>Suppression en cours…</span>
              <span>{progression}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-surface-2">
              <div className="h-full bg-red transition-[width] duration-200" style={{ width: `${progression}%` }} />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onAnnuler}
            disabled={enCours}
            className="rounded-pill border border-line bg-surface px-5 py-2.5 text-[13px] font-bold text-ink-2 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onValider}
            disabled={!peutValider}
            className="rounded-pill bg-red px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {enCours ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
