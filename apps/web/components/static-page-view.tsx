import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** Rendu public d'une page statique (contenu HTML déjà nettoyé au save). */
export function StaticPageView({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 pb-24 pt-12">
        <h1 className="mb-8 border-b-2 border-ink pb-5 font-serif text-[clamp(28px,5vw,42px)] font-medium leading-tight">
          {title}
        </h1>
        <div
          className="font-serif text-[17px] leading-[1.78] text-ink [&_a]:text-blue [&_a]:underline [&_h3]:mt-7 [&_h3]:font-serif [&_h3]:text-[22px] [&_h3]:font-bold [&_h4]:mt-5 [&_h4]:text-[18px] [&_h4]:font-semibold [&_li]:mb-1.5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-2.5 [&_th]:py-1.5 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
