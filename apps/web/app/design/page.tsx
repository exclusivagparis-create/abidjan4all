"use client";

import { Button, Card, RUBRIQUES, RubriqueBadge, ThemeToggle } from "@a4a/ui";

const BRAND = [
  { name: "Navy", varName: "--navy" },
  { name: "Rouge", varName: "--red" },
  { name: "Orange", varName: "--orange" },
  { name: "Vert", varName: "--green" },
];

const SURFACES = [
  { name: "bg", varName: "--bg" },
  { name: "surface", varName: "--surface" },
  { name: "surface-2", varName: "--surface-2" },
  { name: "surface-3", varName: "--surface-3" },
  { name: "line", varName: "--line" },
];

const INKS = [
  { name: "ink", varName: "--ink" },
  { name: "ink-2", varName: "--ink-2" },
  { name: "ink-3", varName: "--ink-3" },
];

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-16 w-full rounded-md border border-line"
        style={{ background: `var(${varName})` }}
      />
      <div className="text-xs font-semibold">{name}</div>
      <code className="text-[11px] text-ink-3">{varName}</code>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 mt-14 border-b border-line pb-3 text-[13px] font-bold uppercase tracking-[0.16em] text-ink-3">
      {children}
    </h2>
  );
}

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-[var(--topbar)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-8 py-3.5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-ink-3">
            Abidjan4All · Design system porté
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8 pb-24">
        <div className="pt-14">
          <div className="mb-4 text-[13px] font-bold uppercase tracking-[0.16em] text-accent">
            Système de design · v1.0 · 2026
          </div>
          <h1 className="max-w-[16ch] font-serif text-6xl font-medium leading-[0.98] tracking-tight">
            La grammaire visuelle d&apos;<span className="text-brand-word">Abidjan</span>
            <span className="text-red">4</span>
            <span className="text-brand-word">All</span>.
          </h1>
          <p className="mt-5 max-w-[60ch] font-serif text-xl leading-relaxed text-ink-2">
            Tokens portés depuis <code className="text-base">Design System.dc.html</code> —
            comparer cette page à la maquette, en clair comme en sombre.
          </p>
        </div>

        <SectionTitle>Couleurs — marque</SectionTitle>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {BRAND.map((c) => (
            <Swatch key={c.varName} {...c} />
          ))}
        </div>

        <SectionTitle>Couleurs — fonds, filets, encres (suivent le thème)</SectionTitle>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {[...SURFACES, ...INKS].map((c) => (
            <Swatch key={c.varName} {...c} />
          ))}
        </div>

        <SectionTitle>Rubriques (14)</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {RUBRIQUES.map((r) => (
            <RubriqueBadge key={r.slug} slug={r.slug} />
          ))}
        </div>

        <SectionTitle>Typographie</SectionTitle>
        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ink-3">
              Newsreader · titres & corps éditorial
            </div>
            <div className="font-serif text-4xl font-medium leading-tight">
              Le cacao ivoirien face aux marchés mondiaux
            </div>
            <p className="mt-2 max-w-[65ch] font-serif text-lg leading-relaxed text-ink-2">
              Dans les plantations de San-Pedro, la récolte s&apos;annonce décisive pour des
              milliers de producteurs — et pour la diaspora qui investit au pays.
            </p>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ink-3">
              Archivo · interface
            </div>
            <div className="text-2xl font-bold">Interface, navigation, boutons</div>
            <div className="mt-1 text-sm text-ink-2">
              Labels, méta-données, chips et éléments de contrôle.
            </div>
          </div>
        </div>

        <SectionTitle>Rayons — 6 / 12 / 16 / 999</SectionTitle>
        <div className="flex flex-wrap items-end gap-5">
          {(["sm", "md", "lg", "pill"] as const).map((r) => (
            <div key={r} className="flex flex-col items-center gap-2">
              <div
                className="h-20 w-28 border border-line bg-surface-2"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <code className="text-[11px] text-ink-3">--radius-{r}</code>
            </div>
          ))}
        </div>

        <SectionTitle>Boutons</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">S&apos;abonner à A4A+</Button>
          <Button variant="secondary">Découvrir</Button>
          <Button variant="accent">En direct</Button>
        </div>

        <SectionTitle>Cartes & ombres</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-3">
          {(["sm", "md", "lg"] as const).map((s) => (
            <Card key={s} style={{ boxShadow: `var(--shadow-${s})` }}>
              <div className="mb-2">
                <RubriqueBadge slug="business" />
              </div>
              <div className="font-serif text-lg font-medium leading-snug">
                Une carte du design system
              </div>
              <div className="mt-2 text-xs text-ink-3">
                surface · line · <code>--shadow-{s}</code>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
