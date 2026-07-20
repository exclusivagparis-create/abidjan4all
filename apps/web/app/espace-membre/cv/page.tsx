import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CvForm, type CvInitial } from "./cv-form";

export const metadata: Metadata = { title: "Mon CV en ligne" };
export const dynamic = "force-dynamic";

type Experience = { role?: string; company?: string; period?: string; detail?: string };
type Education = { school?: string; degree?: string; year?: string };

export default async function MonCvPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/espace-membre/cv");

  const cv = await prisma.cvProfile.findUnique({ where: { userId: session.user.id } });

  const experiences = (cv?.experiences as Experience[] | undefined) ?? [];
  const education = (cv?.education as Education[] | undefined) ?? [];

  const initial: CvInitial = {
    headline: cv?.headline ?? "",
    summary: cv?.summary ?? "",
    phone: cv?.phone ?? "",
    contactEmail: cv?.contactEmail ?? session.user.email ?? "",
    location: cv?.location ?? "",
    skills: (cv?.skills ?? []).join(", "),
    experiences: experiences.map((e) => [e.role, e.company, e.period, e.detail].map((s) => s ?? "").join(" | ")).join("\n"),
    education: education.map((e) => [e.school, e.degree, e.year].map((s) => s ?? "").join(" | ")).join("\n"),
    isPublic: cv?.isPublic ?? true,
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <Link href="/espace-membre" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-3 hover:text-ink">
          ‹ Espace membre
        </Link>
        <div className="mb-3 flex items-center gap-3.5 border-b-2 border-ink pb-6">
          <span className="h-[5px] w-[34px] rounded-[3px] bg-green" />
          <h1 className="font-serif text-[27px] font-medium leading-none sm:text-[33px] lg:text-[38px]">Mon CV en ligne</h1>
        </div>
        <p className="mb-6 max-w-[62ch] font-serif text-[15px] text-ink-2">
          Gratuit. Publiez votre CV dans la banque de CV d&apos;Abidjan4All pour être trouvé par les recruteurs, ou
          gardez-le privé.
          {cv ? (
            <>
              {" "}
              <Link href={`/cv/${session.user.id}`} className="font-semibold text-green hover:underline">
                Voir mon CV public →
              </Link>
            </>
          ) : null}
        </p>
        <CvForm initial={initial} />
      </main>
      <SiteFooter />
    </div>
  );
}
