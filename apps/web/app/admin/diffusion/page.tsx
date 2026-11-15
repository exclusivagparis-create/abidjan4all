import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@a4a/db";
import { PUBLISH_ROLES } from "@/auth";
import { exigerRole } from "@/lib/garde-role";
import { relancerDiffusionAction } from "@/lib/actions/diffusion-actions";

export const metadata: Metadata = { title: "Diffusion sociale · Studio" };
export const dynamic = "force-dynamic";

const LIBELLES: Record<string, { texte: string; couleur: string }> = {
  envoyee: { texte: "Envoyée", couleur: "var(--green)" },
  echec: { texte: "Échec", couleur: "var(--red)" },
  en_attente: { texte: "En cours", couleur: "var(--ink-3)" },
};

function quand(d: Date): string {
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Suivi des annonces poussées vers l'automate de diffusion.
 *
 * Le site n'écrit sur aucun réseau lui-même : à chaque mise en ligne, il
 * envoie une annonce signée à Activepieces, qui détient les autorisations de
 * Facebook et des autres et se charge de publier. Cet écran montre ce qui est
 * parti — et surtout ce qui a échoué, qui serait sinon invisible.
 */
export default async function AdminDiffusion() {
  if (!(await exigerRole(PUBLISH_ROLES))) redirect("/admin");

  const configuree = Boolean(process.env.DIFFUSION_WEBHOOK_URL && process.env.DIFFUSION_WEBHOOK_SECRET);

  const lignes = await prisma.diffusionArticle.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      statut: true,
      codeHttp: true,
      erreur: true,
      essais: true,
      envoyeeAt: true,
      createdAt: true,
      article: { select: { title: true, slug: true, rubrique: { select: { slug: true } } } },
    },
  });

  const echecs = lignes.filter((l) => l.statut === "echec").length;

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">Diffusion sociale</h1>
      <p className="mb-6 max-w-[70ch] text-[12.5px] text-ink-3">
        Chaque article mis en ligne — à la main ou à l&apos;heure programmée — est annoncé à l&apos;automate, qui le
        publie sur la page Facebook et les autres réseaux branchés. Cet écran montre ce qui est parti. Modifier un
        article déjà publié ne le renvoie pas : seule la première mise en ligne déclenche une annonce.
      </p>

      {!configuree ? (
        <p className="mb-5 rounded-md bg-[rgba(244,121,32,0.12)] px-4 py-3 text-[13px] text-ink-2">
          <strong>La diffusion n&apos;est pas branchée.</strong> Les variables <code>DIFFUSION_WEBHOOK_URL</code> et{" "}
          <code>DIFFUSION_WEBHOOK_SECRET</code> sont vides sur le serveur : les articles paraissent sur le site, et
          nulle part ailleurs. Rien n&apos;est perdu, rien n&apos;est enregistré ici tant qu&apos;elles le restent.
        </p>
      ) : null}

      {echecs > 0 ? (
        <p className="mb-5 rounded-md bg-[rgba(214,40,45,0.1)] px-4 py-2.5 text-[13px] font-semibold text-red">
          {echecs} annonce{echecs > 1 ? "s" : ""} en échec — ces articles ne sont pas sur la page.
        </p>
      ) : null}

      {lignes.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line bg-surface-2 px-5 py-8 text-center text-[13px] text-ink-3">
          Aucune annonce pour l&apos;instant. La première partira à la prochaine mise en ligne d&apos;un article.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                <th className="px-4 py-2.5">Article</th>
                <th className="px-4 py-2.5">État</th>
                <th className="px-4 py-2.5">Quand</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const etat = LIBELLES[l.statut] ?? LIBELLES.en_attente!;
                return (
                  <tr key={l.id} className="border-b border-line-2 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${l.article.rubrique.slug}/${l.article.slug}`}
                        className="font-semibold text-ink hover:underline"
                      >
                        {l.article.title.replace(/\*/g, "")}
                      </Link>
                      {l.erreur ? <div className="mt-1 text-[12px] text-ink-3">{l.erreur}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-semibold" style={{ color: etat.couleur }}>
                        {etat.texte}
                      </span>
                      {l.codeHttp ? <span className="ml-1.5 text-[12px] text-ink-3">({l.codeHttp})</span> : null}
                      {l.essais > 1 ? <div className="text-[12px] text-ink-3">{l.essais} essais</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-3">{quand(l.envoyeeAt ?? l.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {l.statut === "echec" ? (
                        <form action={relancerDiffusionAction}>
                          <input type="hidden" name="id" value={l.id} />
                          <button
                            type="submit"
                            className="rounded-[8px] border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
                          >
                            Renvoyer
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
