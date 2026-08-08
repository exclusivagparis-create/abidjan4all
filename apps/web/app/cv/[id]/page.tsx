import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { peutVoirCoordonnees } from "@/lib/recruteur";
import { initials } from "@/lib/format";

export const dynamic = "force-dynamic";

type Experience = { role?: string; company?: string; period?: string; detail?: string };
type Education = { school?: string; degree?: string; year?: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const cv = await prisma.cvProfile.findUnique({ where: { userId: id }, include: { user: { select: { name: true } } } });
  if (!cv) return {};
  return { title: `${cv.user.name} — ${cv.headline}`, description: cv.summary ?? undefined };
}

export default async function CvPubliquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cv, session] = await Promise.all([
    prisma.cvProfile.findUnique({
      where: { userId: id },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    auth(),
  ]);
  if (!cv) notFound();

  // CV privé : seul son propriétaire peut le consulter.
  const estProprietaire = session?.user?.id === cv.userId;
  if (!cv.isPublic && !estProprietaire) notFound();

  const coordonneesVisibles = estProprietaire || (await peutVoirCoordonnees(session?.user));

  const experiences = (cv.experiences as Experience[]) ?? [];
  const education = (cv.education as Education[]) ?? [];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <Link href="/cv" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
          ‹ Banque de CV
        </Link>

        {!cv.isPublic ? (
          <p className="mb-4 rounded-[8px] bg-surface-2 px-4 py-2 text-[12.5px] font-semibold text-ink-3">
            CV privé — visible de vous seul.
          </p>
        ) : null}

        <header className="mb-6 flex items-center gap-4 border-b-2 border-ink pb-6">
          {cv.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cv.user.avatarUrl} alt="" className="h-16 w-16 flex-none rounded-pill object-cover" />
          ) : (
            <span className="flex h-16 w-16 flex-none items-center justify-center rounded-pill bg-[#006633] text-[20px] font-bold text-white">
              {initials(cv.user.name)}
            </span>
          )}
          <div>
            <h1 className="font-serif text-[26px] font-semibold leading-tight">{cv.user.name}</h1>
            <div className="text-[15px] text-ink-2">{cv.headline}</div>
            {cv.location ? <div className="text-[12.5px] text-ink-3">{cv.location}</div> : null}
          </div>
        </header>

        {cv.summary ? <p className="mb-7 max-w-[65ch] font-serif text-[16px] leading-[1.55] text-ink-2">{cv.summary}</p> : null}

        {cv.skills.length > 0 ? (
          <section className="mb-7">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Compétences</h2>
            <div className="flex flex-wrap gap-2">
              {cv.skills.map((s) => (
                <span key={s} className="rounded-pill border border-line bg-surface-2 px-3 py-1 text-[12.5px] font-semibold text-ink-2">
                  {s}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {experiences.length > 0 ? (
          <section className="mb-7">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Expériences</h2>
            <div className="flex flex-col gap-4">
              {experiences.map((e, i) => (
                <div key={i} className="border-l-2 border-line pl-4">
                  <div className="font-serif text-[16px] font-semibold">
                    {e.role}
                    {e.company ? <span className="text-ink-2"> — {e.company}</span> : null}
                  </div>
                  {e.period ? <div className="text-[12px] text-ink-3">{e.period}</div> : null}
                  {e.detail ? <div className="mt-0.5 text-[13.5px] text-ink-2">{e.detail}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {education.length > 0 ? (
          <section className="mb-7">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Formation</h2>
            <div className="flex flex-col gap-2">
              {education.map((e, i) => (
                <div key={i} className="text-[14px]">
                  <span className="font-semibold">{e.degree}</span>
                  {e.school ? <span className="text-ink-2"> · {e.school}</span> : null}
                  {e.year ? <span className="text-ink-3"> · {e.year}</span> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Coordonnées : le produit vendu aux recruteurs (pilier 5). Le CV
            reste public — seul le moyen de joindre le candidat est réservé.
            Le candidat voit toujours ses propres coordonnées. */}
        {(cv.contactEmail || cv.phone) && cv.isPublic ? (
          coordonneesVisibles ? (
            <section className="rounded-[12px] border border-line bg-surface-2 px-5 py-4">
              <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Contact</h2>
              {cv.contactEmail ? <div className="text-[14px]"><a href={`mailto:${cv.contactEmail}`} className="text-green hover:underline">{cv.contactEmail}</a></div> : null}
              {cv.phone ? <div className="text-[14px] text-ink-2">{cv.phone}</div> : null}
            </section>
          ) : (
            <section className="rounded-[12px] border border-[#0E5A8A] bg-[rgba(14,90,138,0.06)] px-5 py-5">
              <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0E5A8A]">
                Coordonnées réservées aux recruteurs
              </h2>
              <p className="mb-3 max-w-[54ch] text-[13.5px] leading-[1.55] text-ink-2">
                L&apos;e-mail et le téléphone de ce candidat sont accessibles avec un accès recruteur A4A — comme pour
                l&apos;ensemble de la CVthèque.
              </p>
              <Link href="/recruteur" className="inline-block rounded-pill bg-[#0E5A8A] px-5 py-2.5 text-[13px] font-bold text-white">
                Découvrir l&apos;accès recruteur
              </Link>
            </section>
          )
        ) : null}

        {estProprietaire ? (
          <Link href="/espace-membre/cv" className="mt-6 inline-block text-[13px] font-semibold text-ink-3 hover:text-ink">
            ✎ Modifier mon CV
          </Link>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
