import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@a4a/db";
import { PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { formatDate } from "@/lib/format";
import {
  SEUIL_BREVE_DEFAUT,
  SEUIL_MAX,
  SEUIL_MIN,
  estBreve,
  histogramme,
  portee,
  seuilValide,
} from "@/lib/qualite-editoriale";
import {
  basculerNoindexAction,
  reindexerAuDessusAction,
  retirerBrevesAction,
} from "@/lib/actions/qualite-actions";

export const metadata: Metadata = { title: "Qualité éditoriale" };
export const dynamic = "force-dynamic";

/**
 * Écran « Qualité éditoriale ».
 *
 * Né de l'avertissement AdSense du 11 octobre 2026, « Contenu à faible valeur
 * informative ». Il montre la distribution réelle des longueurs, ce qu'une
 * désindexation coûterait en trafic, et donne les deux leviers — par lot et au
 * cas par cas — pour que la rédaction agisse sans développeur.
 *
 * Le parti pris : afficher les VUES à côté du nombre d'articles. C'est la
 * seule réponse à la seule objection sérieuse — « et le trafic qu'on perd ? ».
 * Quand la tranche d'une minute pèse 46 % des pages et 3,4 vues par article en
 * trois mois, la décision se prend d'elle-même ; mais il faut l'avoir sous les
 * yeux, pas sur parole.
 */
export default async function QualitePage({
  searchParams,
}: {
  searchParams: Promise<{ seuil?: string; page?: string }>;
}) {
  const [{ seuil: seuilBrut, page: pageBrute }, moi] = await Promise.all([
    searchParams,
    exigerRole(PUBLISH_ROLES),
  ]);
  if (!moi) redirect("/admin");

  const seuil = seuilValide(seuilBrut ?? SEUIL_BREVE_DEFAUT);
  const page = Math.max(1, Number(pageBrute) || 1);
  const PAR_PAGE = 50;

  const [corpus, total] = await Promise.all([
    prisma.article.findMany({
      where: { status: "published" },
      select: { readingTime: true, views: true, noindex: true },
    }),
    prisma.article.count({ where: { status: "published" } }),
  ]);

  const tranches = histogramme(corpus, seuil);
  const p = portee(corpus, seuil);

  // La liste détaillée : les plus courts d'abord, puis les moins lus. C'est
  // l'ordre dans lequel on traite — le pire en premier.
  const liste = await prisma.article.findMany({
    where: { status: "published", readingTime: { lte: seuil } },
    select: {
      id: true,
      slug: true,
      title: true,
      readingTime: true,
      views: true,
      noindex: true,
      publishedAt: true,
      rubrique: { select: { slug: true, name: true } },
    },
    orderBy: [{ readingTime: "asc" }, { views: "asc" }],
    skip: (page - 1) * PAR_PAGE,
    take: PAR_PAGE,
  });
  const pages = Math.max(1, Math.ceil(p.vises / PAR_PAGE));

  const carte = "rounded-[14px] border border-line bg-surface p-5";
  const chiffre = "font-serif text-[30px] font-semibold leading-none text-ink";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-[26px] font-semibold text-ink">Qualité éditoriale</h1>
        <p className="mt-1 max-w-[760px] text-[13.5px] leading-relaxed text-ink-2">
          AdSense a suspendu la diffusion le 11 octobre 2026 au motif «&nbsp;Contenu à faible valeur
          informative&nbsp;». Google juge un site sur la substance de ses pages et sur l&apos;intérêt
          qu&apos;elles suscitent. Cet écran mesure les deux et permet de retirer les brèves de
          l&apos;index — elles restent en ligne, lisibles et liées ; elles cessent seulement de
          compter dans ce jugement.
        </p>
      </header>

      {/* Les quatre chiffres qui résument la situation au seuil retenu. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={carte}>
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Publiés</div>
          <div className={`mt-2 ${chiffre}`}>{total.toLocaleString("fr-FR")}</div>
          <div className="mt-1 text-[12px] text-ink-3">articles en ligne</div>
        </div>
        <div className={carte}>
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
            Brèves (≤ {seuil} min)
          </div>
          <div className={`mt-2 ${chiffre}`} style={{ color: "#E8641A" }}>
            {p.vises.toLocaleString("fr-FR")}
          </div>
          <div className="mt-1 text-[12px] text-ink-3">
            {total ? Math.round((1000 * p.vises) / total) / 10 : 0} % du site
          </div>
        </div>
        <div className={carte}>
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
            Déjà retirées
          </div>
          <div className={`mt-2 ${chiffre}`}>{p.dejaRetires.toLocaleString("fr-FR")}</div>
          <div className="mt-1 text-[12px] text-ink-3">
            {p.aRetirer.toLocaleString("fr-FR")} restent à retirer
          </div>
        </div>
        <div className={carte}>
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
            Resterait à l&apos;index
          </div>
          <div className={`mt-2 ${chiffre}`} style={{ color: "#2E7D32" }}>
            {p.restants.toLocaleString("fr-FR")}
          </div>
          <div className="mt-1 text-[12px] text-ink-3">pages substantielles</div>
        </div>
      </div>

      {/* Réglage du seuil : un lien par valeur, pour que l'URL porte le choix
          et qu'on puisse comparer deux seuils en revenant en arrière. */}
      <div className={carte}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-semibold text-ink">Seuil de la brève</span>
          <div className="flex gap-1.5">
            {Array.from({ length: SEUIL_MAX - SEUIL_MIN + 1 }, (_, i) => SEUIL_MIN + i).map((v) => (
              <Link
                key={v}
                href={`/admin/qualite?seuil=${v}`}
                className={`rounded-pill px-3 py-1 text-[12px] font-semibold ${
                  v === seuil
                    ? "bg-[#111826] text-white"
                    : "border border-line bg-surface-2 text-ink-2 hover:text-ink"
                }`}
              >
                ≤ {v} min
              </Link>
            ))}
          </div>
          <span className="text-[11.5px] text-ink-3">
            Une minute vaut environ 200 mots.
          </span>
        </div>
      </div>

      {/* Histogramme : articles ET vues, côte à côte. */}
      <div className={carte}>
        <h2 className="font-serif text-[18px] font-semibold text-ink">Distribution des longueurs</h2>
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
              <th className="py-1.5">Durée</th>
              <th className="py-1.5">Articles</th>
              <th className="py-1.5">Part</th>
              <th className="py-1.5">Vues cumulées</th>
              <th className="py-1.5">Vues / article</th>
            </tr>
          </thead>
          <tbody>
            {tranches.map((t) => (
              <tr key={t.minutes} className="border-t border-line">
                <td className="py-1.5 font-semibold text-ink">
                  {t.minutes} min
                  {t.breve ? (
                    <span className="ml-2 rounded-pill bg-[rgba(232,100,26,0.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#E8641A]">
                      brève
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 text-ink-2">{t.articles.toLocaleString("fr-FR")}</td>
                <td className="py-1.5 text-ink-2">{t.part} %</td>
                <td className="py-1.5 text-ink-2">{t.vues.toLocaleString("fr-FR")}</td>
                <td className="py-1.5 text-ink-2">
                  {t.articles ? Math.round((10 * t.vues) / t.articles) / 10 : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Les deux leviers par lot. */}
      <div className={`${carte} border-[rgba(232,100,26,0.4)]`}>
        <h2 className="font-serif text-[18px] font-semibold text-ink">Agir par lot</h2>
        <p className="mt-1.5 max-w-[720px] text-[13px] leading-relaxed text-ink-2">
          Au seuil de <strong>{seuil} minutes</strong>, l&apos;opération retirerait{" "}
          <strong>{p.aRetirer.toLocaleString("fr-FR")}</strong> articles de l&apos;index, qui
          totalisent <strong>{p.vuesPerdues.toLocaleString("fr-FR")}</strong> vues depuis la mise en
          service du compteur. Ils resteront en ligne et accessibles par leurs liens.
          {p.retiresAuDessus > 0 ? (
            <>
              {" "}
              Par ailleurs, {p.retiresAuDessus.toLocaleString("fr-FR")} article
              {p.retiresAuDessus > 1 ? "s" : ""} au-dessus du seuil {p.retiresAuDessus > 1 ? "sont" : "est"}{" "}
              retiré{p.retiresAuDessus > 1 ? "s" : ""} de l&apos;index — un choix fait à la main, que
              le bouton ci-dessous ne touche pas.
            </>
          ) : null}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={retirerBrevesAction}>
            <input type="hidden" name="seuil" value={seuil} />
            <button
              type="submit"
              disabled={p.aRetirer === 0}
              className="rounded-pill bg-[#111826] px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              Retirer de l&apos;index les {p.aRetirer.toLocaleString("fr-FR")} brèves
            </button>
          </form>
          <form action={reindexerAuDessusAction}>
            <input type="hidden" name="seuil" value={seuil} />
            <button
              type="submit"
              className="rounded-pill border border-line bg-surface-2 px-4 py-2 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
            >
              Remettre à l&apos;index ce qui dépasse {seuil} min
            </button>
          </form>
        </div>
      </div>

      {/* La liste, pour le cas par cas : les plus courts et les moins lus d'abord. */}
      <div className={carte}>
        <h2 className="font-serif text-[18px] font-semibold text-ink">
          Les brèves, les plus courtes et les moins lues d&apos;abord
        </h2>
        {liste.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-2">Aucun article sous ce seuil.</p>
        ) : (
          <>
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                  <th className="py-1.5">Titre</th>
                  <th className="py-1.5">Rubrique</th>
                  <th className="py-1.5">Durée</th>
                  <th className="py-1.5">Vues</th>
                  <th className="py-1.5">Index</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {liste.map((a) => (
                  <tr key={a.id} className="border-t border-line align-top">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/admin/articles/${a.id}`}
                        className="font-semibold text-ink hover:underline"
                      >
                        {a.title}
                      </Link>
                      <div className="text-[11px] text-ink-3">
                        {a.publishedAt ? formatDate(a.publishedAt) : "—"}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-ink-2">{a.rubrique.name}</td>
                    <td className="py-2 pr-3 text-ink-2">{a.readingTime} min</td>
                    <td className="py-2 pr-3 text-ink-2">{a.views}</td>
                    <td className="py-2 pr-3">
                      {a.noindex ? (
                        <span className="text-[11.5px] font-semibold text-ink-3">Retiré</span>
                      ) : (
                        <span className="text-[11.5px] font-semibold text-[#2E7D32]">Indexé</span>
                      )}
                    </td>
                    <td className="py-2">
                      <form action={basculerNoindexAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:text-ink"
                        >
                          {a.noindex ? "Réindexer" : "Retirer"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pages > 1 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
                {page > 1 ? (
                  <Link
                    href={`/admin/qualite?seuil=${seuil}&page=${page - 1}`}
                    className="rounded-pill border border-line px-3 py-1 font-semibold text-ink-2 hover:text-ink"
                  >
                    ← Précédent
                  </Link>
                ) : null}
                <span className="text-ink-3">
                  Page {page} sur {pages}
                </span>
                {page < pages ? (
                  <Link
                    href={`/admin/qualite?seuil=${seuil}&page=${page + 1}`}
                    className="rounded-pill border border-line px-3 py-1 font-semibold text-ink-2 hover:text-ink"
                  >
                    Suivant →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-3">
        Un article retiré de l&apos;index porte la balise <code>noindex, follow</code> et sort du
        sitemap. Il reste affiché dans sa rubrique, dans la recherche interne et au bout de tous ses
        liens : <code>follow</code> plutôt que <code>nofollow</code> pour que le maillage interne et
        les 3 384 redirections de l&apos;ancien domaine continuent de porter leur autorité vers les
        pages indexées. Google met plusieurs semaines à répercuter un retrait.
      </p>
    </div>
  );
}
