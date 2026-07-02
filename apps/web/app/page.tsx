import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1180px] flex-col items-start justify-center gap-6 px-8">
      <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-accent">
        Abidjan4All · fondations · 2026
      </div>
      <h1 className="max-w-[16ch] font-serif text-6xl font-medium leading-[0.98] tracking-tight">
        Le média numérique de la <span className="text-brand-word">Côte d&apos;Ivoire</span> et de
        la diaspora.
      </h1>
      <p className="max-w-[60ch] font-serif text-xl leading-relaxed text-ink-2">
        Monorepo initialisé : Next.js 15, Tailwind 4, Prisma/PostgreSQL et le design system du
        handoff. Les écrans publics arrivent avec la phase DF-01.
      </p>
      <Link
        href="/design"
        className="rounded-pill bg-brand-fill px-5 py-3 text-[13px] font-semibold text-brand-on"
      >
        Voir le design system →
      </Link>
    </main>
  );
}
