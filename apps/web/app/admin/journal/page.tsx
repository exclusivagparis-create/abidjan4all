import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";
import { Pagination } from "@/components/admin/pagination";
import { JournalEntree } from "@/components/admin/journal-entree";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Journal des suppressions · Studio" };
export const dynamic = "force-dynamic";

const PAR_PAGE = 40;

/**
 * Consultation du journal des suppressions.
 *
 * Le journal des articles existait depuis le 19 août et n'était lu nulle part :
 * 2 105 suppressions y dormaient, avec leur contenu complet, sans qu'aucun
 * écran ne permette de les voir. Un filet dans lequel on ne peut pas regarder
 * ne rattrape personne — au mieux il rassure, ce qui est pire que rien.
 *
 * Réservé à la rédaction en chef et à l'administration : le journal dit QUI a
 * effacé QUOI, et contient l'intégralité des contenus disparus, y compris ceux
 * qui n'étaient pas publics.
 */
export default async function AdminJournal({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; page?: string }>;
}) {
  const { type = "articles", q = "", page: pageBrute } = await searchParams;
  const session = await auth();
  if (!PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number])) {
    return (
      <div className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center">
        <p className="text-[14px] font-semibold">Réservé à la rédaction en chef et à l&apos;administration.</p>
        <p className="mt-1.5 text-[12.5px] text-ink-2">
          Le journal contient l&apos;intégralité des contenus supprimés, publiés ou non.
        </p>
      </div>
    );
  }

  const query = q.trim();
  const surLesDirects = type === "directs";

  const [nbArticles, nbDirects] = await Promise.all([
    prisma.articleDeletion.count(),
    prisma.liveDeletion.count(),
  ]);

  const total = surLesDirects ? nbDirects : nbArticles;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const page = Math.min(pages, Math.max(1, Number(pageBrute) || 1));
  const skip = (page - 1) * PAR_PAGE;

  // Deux journaux de forme différente, ramenés à une même ligne d'affichage :
  // c'est la même question qu'on pose aux deux — qui a effacé quoi, et quand.
  const entrees = surLesDirects
    ? (
        await prisma.liveDeletion.findMany({
          where: query
            ? { OR: [{ liveBlogTitle: { contains: query, mode: "insensitive" } }, { extrait: { contains: query, mode: "insensitive" } }] }
            : {},
          orderBy: { createdAt: "desc" },
          skip,
          take: PAR_PAGE,
        })
      ).map((d) => ({
        id: d.id,
        quand: formatDate(d.createdAt),
        par: d.deletedByName,
        titre: d.liveBlogTitle,
        detail: d.extrait,
        etiquette: d.kind === "blog" ? `Direct entier — ${d.updatesCount} mises à jour` : "Mise à jour",
        snapshot: JSON.stringify(d.snapshot, null, 2),
      }))
    : (
        await prisma.articleDeletion.findMany({
          where: query
            ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] }
            : {},
          orderBy: { createdAt: "desc" },
          skip,
          take: PAR_PAGE,
        })
      ).map((d) => ({
        id: d.id,
        quand: formatDate(d.createdAt),
        par: d.deletedByName,
        titre: d.title,
        detail: `/${d.slug}`,
        etiquette: d.status === "published" ? "Était publié" : `Était ${d.status}`,
        snapshot: JSON.stringify(d.snapshot, null, 2),
      }));

  const onglet = (cle: string, libelle: string, n: number) => (
    <Link
      key={cle}
      href={`/admin/journal?type=${cle}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
      className={`rounded-pill px-[15px] py-2 text-[13px] font-semibold ${
        (cle === "directs") === surLesDirects ? "bg-navy text-white" : "border border-line bg-surface text-ink-2"
      }`}
    >
      {libelle} <span className={(cle === "directs") === surLesDirects ? "opacity-60" : "text-ink-2"}>{n}</span>
    </Link>
  );

  return (
    <div>
      <h1 className="mb-1.5 text-lg font-bold">Journal des suppressions</h1>
      <p className="mb-5 max-w-[720px] text-[12.5px] leading-relaxed text-ink-2">
        Tout contenu supprimé du Studio est conservé ici avec son contenu intégral, la date et l&apos;auteur du
        geste. C&apos;est la seule voie de retour après une suppression : rien n&apos;est réellement perdu tant
        qu&apos;une entrée figure dans cette liste.
      </p>

      <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="type" value={surLesDirects ? "directs" : "articles"} />
        <input
          name="q"
          defaultValue={query}
          placeholder={surLesDirects ? "Rechercher un direct, un extrait…" : "Rechercher un titre, un slug…"}
          className="min-w-[260px] flex-1 rounded-pill border border-line bg-surface px-4 py-2 text-[13px] outline-none"
        />
        <button type="submit" className="rounded-pill bg-navy px-4 py-2 text-[13px] font-semibold text-white">
          Rechercher
        </button>
        {query ? (
          <Link
            href={`/admin/journal?type=${surLesDirects ? "directs" : "articles"}`}
            className="text-[12.5px] font-semibold text-ink-2"
          >
            Réinitialiser
          </Link>
        ) : null}
      </form>

      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        {onglet("articles", "Articles", nbArticles)}
        {onglet("directs", "Directs", nbDirects)}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {entrees.map((e) => (
          <JournalEntree key={e.id} {...e} />
        ))}
        {entrees.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13px] text-ink-2">
            {query ? `Aucune suppression ne correspond à « ${query} ».` : "Aucune suppression enregistrée."}
          </p>
        ) : null}
      </div>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        debut={skip + 1}
        fin={skip + entrees.length}
        base="/admin/journal"
        params={{ type: surLesDirects ? "directs" : undefined, q: query || undefined }}
        libelle="suppressions"
      />
    </div>
  );
}
