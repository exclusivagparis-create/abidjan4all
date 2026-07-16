import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez la rédaction d'Abidjan4All.",
  alternates: { canonical: "/contact" },
};

// Le pied de page interroge la base (rubriques, pages) — rendu à la requête.
export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <h1 className="mb-3 border-b-2 border-ink pb-5 font-serif text-[clamp(28px,5vw,40px)] font-medium">Nous contacter</h1>
        <p className="mb-8 max-w-[60ch] font-serif text-[15px] leading-relaxed text-ink-2">
          Une question, une information, une correction ou une demande de partenariat ? Écrivez-nous — la rédaction
          d&apos;Abidjan4All vous répond sous 48 heures ouvrées.
        </p>
        <ContactForm />
      </main>
      <SiteFooter />
    </div>
  );
}
