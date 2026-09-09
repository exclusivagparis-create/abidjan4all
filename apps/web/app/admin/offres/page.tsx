import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { formatXOF } from "@a4a/payments";
import { auth, PUBLISH_ROLES } from "@/auth";
import { prixDu } from "@/lib/offres";
import { createOfferAction, toggleOfferAction, updateOfferAction } from "@/lib/actions/offer-actions";

export const metadata: Metadata = { title: "Offres A4A+ · Studio" };
export const dynamic = "force-dynamic";

const ERREURS: Record<string, string> = {
  nom: "Le nom de l'offre est obligatoire.",
  prix: "Le prix doit être supérieur à zéro.",
  slug: "L'identifiant est vide ou ne contient aucun caractère exploitable.",
  slug_pris: "Cet identifiant est déjà utilisé par une autre offre.",
  slug_reserve: "L'offre « free » est le socle des comptes sans abonnement : elle n'est pas modifiable.",
  introuvable: "Offre introuvable.",
};

const OK: Record<string, string> = {
  creee: "Offre créée.",
  enregistree: "Modifications enregistrées.",
  activee: "Offre réactivée — elle réapparaît sur la page d'abonnement.",
  desactivee: "Offre désactivée — retirée de la page publique, les abonnés en cours la conservent.",
};

/** `<input type="date">` attend AAAA-MM-JJ. */
function pourInputDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function AdminOffres({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; ok?: string }>;
}) {
  const [{ erreur, ok }, session] = await Promise.all([searchParams, auth()]);
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) redirect("/admin");

  const maintenant = new Date();
  const offres = await prisma.offer.findMany({
    where: { id: { not: "free" } },
    orderBy: [{ ordre: "asc" }, { price: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  const inp = "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px]";
  const lbl = "mb-1 block text-[11px] font-bold uppercase tracking-[0.05em] text-ink-3";

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Offres A4A+</h1>
      <p className="mb-6 max-w-[80ch] text-[12.5px] text-ink-3">
        La grille tarifaire de la page <b>S&apos;abonner</b>. Les prix, descriptifs et remises se modifient ici, sans
        déploiement. Une offre ne se supprime pas : elle se <b>désactive</b> — elle disparaît de la page publique,
        tandis que les abonnés qui la détiennent la conservent jusqu&apos;à leur échéance.
      </p>

      {erreur && ERREURS[erreur] ? (
        <p className="mb-4 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {ERREURS[erreur]}
        </p>
      ) : null}
      {ok && OK[ok] ? (
        <p className="mb-4 rounded-md bg-[rgba(0,102,51,0.1)] px-4 py-2.5 text-[13px] font-semibold text-green">
          {OK[ok]}
        </p>
      ) : null}

      {/* ---------- Offres existantes ---------- */}
      <div className="mb-8 flex flex-col gap-5">
        {offres.map((o) => {
          const calc = prixDu(o, maintenant);
          return (
            <section
              key={o.id}
              className={`rounded-[14px] border bg-surface p-5 ${o.active ? "border-line" : "border-dashed border-line opacity-70"}`}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-[15px] font-bold">{o.name}</h2>
                <code className="rounded-[6px] bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">{o.id}</code>
                {!o.active ? (
                  <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-[10.5px] font-bold uppercase text-ink-3">
                    Désactivée
                  </span>
                ) : null}
                {calc.remise ? (
                  <span className="rounded-pill bg-[rgba(0,102,51,0.1)] px-2.5 py-1 text-[10.5px] font-bold text-green">
                    Remise active — {formatXOF(calc.prix)} au lieu de {formatXOF(o.price)}
                  </span>
                ) : null}
                <span className="ml-auto text-[11.5px] text-ink-3">
                  {o._count.subscriptions} abonné{o._count.subscriptions > 1 ? "s" : ""}
                </span>
              </div>

              <form action={updateOfferAction.bind(null, o.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={lbl} htmlFor={`name-${o.id}`}>Nom</label>
                  <input id={`name-${o.id}`} name="name" defaultValue={o.name} className={inp} />
                </div>
                <div>
                  <label className={lbl} htmlFor={`price-${o.id}`}>Prix catalogue (FCFA / mois)</label>
                  <input id={`price-${o.id}`} name="price" type="number" min={1} defaultValue={o.price} className={inp} />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl} htmlFor={`tagline-${o.id}`}>Accroche</label>
                  <input id={`tagline-${o.id}`} name="tagline" defaultValue={o.tagline} className={inp} />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl} htmlFor={`features-${o.id}`}>Avantages — un par ligne</label>
                  <textarea
                    id={`features-${o.id}`}
                    name="features"
                    rows={Math.max(3, o.features.length)}
                    defaultValue={o.features.join("\n")}
                    className={`${inp} resize-y font-mono text-[12.5px]`}
                  />
                </div>

                {/* --- Remise --- */}
                <div>
                  <label className={lbl} htmlFor={`dk-${o.id}`}>Remise</label>
                  <select id={`dk-${o.id}`} name="discountKind" defaultValue={o.discountKind} className={inp}>
                    <option value="none">Aucune</option>
                    <option value="percent">Pourcentage</option>
                    <option value="amount">Montant en francs</option>
                  </select>
                </div>
                <div>
                  <label className={lbl} htmlFor={`dv-${o.id}`}>Valeur de la remise</label>
                  <input id={`dv-${o.id}`} name="discountValue" type="number" min={0} defaultValue={o.discountValue} className={inp} />
                </div>
                <div>
                  <label className={lbl} htmlFor={`df-${o.id}`}>Début (facultatif)</label>
                  <input id={`df-${o.id}`} name="discountFrom" type="date" defaultValue={pourInputDate(o.discountFrom)} className={inp} />
                </div>
                <div>
                  <label className={lbl} htmlFor={`dt-${o.id}`}>Fin (facultatif)</label>
                  <input id={`dt-${o.id}`} name="discountTo" type="date" defaultValue={pourInputDate(o.discountTo)} className={inp} />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl} htmlFor={`dl-${o.id}`}>Mention affichée à la place de « Économisez … »</label>
                  <input id={`dl-${o.id}`} name="discountLabel" defaultValue={o.discountLabel ?? ""} placeholder="Rentrée 2026" className={inp} />
                </div>

                <div>
                  <label className={lbl} htmlFor={`ordre-${o.id}`}>Ordre d&apos;affichage</label>
                  <input id={`ordre-${o.id}`} name="ordre" type="number" defaultValue={o.ordre} className={inp} />
                </div>
                <div className="flex items-end gap-5 pb-1">
                  <label className="flex items-center gap-2 text-[12.5px]">
                    <input type="checkbox" name="highlight" defaultChecked={o.highlight} /> Mise en avant
                  </label>
                  <label className="flex items-center gap-2 text-[12.5px]">
                    <input type="checkbox" name="active" defaultChecked={o.active} /> Active
                  </label>
                </div>

                <div className="sm:col-span-2 flex flex-wrap gap-2.5">
                  <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
                    Enregistrer
                  </button>
                </div>
              </form>

              <form action={toggleOfferAction.bind(null, o.id)} className="mt-2.5">
                <button
                  type="submit"
                  className="rounded-pill border border-line bg-surface px-4 py-2 text-[11.5px] font-semibold text-ink-2 hover:text-ink"
                >
                  {o.active ? "Désactiver cette offre" : "Réactiver cette offre"}
                </button>
              </form>
            </section>
          );
        })}
      </div>

      {/* ---------- Nouvelle offre ---------- */}
      <section className="rounded-[14px] border border-dashed border-line bg-surface-2 p-5">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-3">Nouvelle offre</div>
        <p className="mb-4 max-w-[70ch] text-[12.5px] text-ink-3">
          L&apos;identifiant est définitif : il est inscrit dans chaque abonnement et chaque paiement, le renommer
          réécrirait l&apos;historique. Laissé vide, il est déduit du nom.
        </p>
        <form action={createOfferAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="new-name">Nom</label>
            <input id="new-name" name="name" placeholder="Étudiant" className={inp} />
          </div>
          <div>
            <label className={lbl} htmlFor="new-id">Identifiant (facultatif)</label>
            <input id="new-id" name="id" placeholder="etudiant" className={inp} />
          </div>
          <div>
            <label className={lbl} htmlFor="new-price">Prix catalogue (FCFA / mois)</label>
            <input id="new-price" name="price" type="number" min={1} defaultValue={1000} className={inp} />
          </div>
          <div>
            <label className={lbl} htmlFor="new-ordre">Ordre d&apos;affichage</label>
            <input id="new-ordre" name="ordre" type="number" defaultValue={offres.length + 1} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl} htmlFor="new-tagline">Accroche</label>
            <input id="new-tagline" name="tagline" placeholder="Le journal à tarif étudiant." className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl} htmlFor="new-features">Avantages — un par ligne</label>
            <textarea id="new-features" name="features" rows={4} className={`${inp} resize-y font-mono text-[12.5px]`} />
          </div>
          <div className="flex items-end gap-5 pb-1 sm:col-span-2">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" name="highlight" /> Mise en avant
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-pill bg-brand-fill px-5 py-2.5 text-xs font-bold text-brand-on">
              Créer l&apos;offre
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
