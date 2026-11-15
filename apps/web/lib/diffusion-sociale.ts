import { prisma } from "@a4a/db";
import { construirePayload, signer, type ArticleADiffuser } from "@/lib/diffusion-regles";

/**
 * Envoi d'une annonce de publication vers l'automate de diffusion.
 *
 * Appelé aux deux endroits où un article bascule en ligne : la publication
 * manuelle depuis le Studio, et la publication programmée par le
 * planificateur. Les deux passaient déjà par `sendArticleAlert` ; la diffusion
 * sociale se range à côté, sans s'y mêler — une alerte push ratée ne doit pas
 * empêcher la publication Facebook, ni l'inverse.
 *
 * Ne lève jamais : un réseau indisponible ne doit pas faire échouer la mise en
 * ligne d'un article. L'échec est écrit en base, et la rédaction le voit dans
 * le Studio, où elle peut relancer.
 */

/** Au-delà, on considère l'automate injoignable. Il répond d'ordinaire en moins d'une seconde. */
const DELAI_MS = 10_000;

export async function diffuserArticle(articleId: string): Promise<void> {
  const url = process.env.DIFFUSION_WEBHOOK_URL;
  const secret = process.env.DIFFUSION_WEBHOOK_SECRET;
  const racine = process.env.NEXT_PUBLIC_SITE_URL;

  // Non configuré = fonction désactivée, sans bruit. C'est l'état d'un
  // environnement de développement, et celui de la production tant que le flux
  // n'est pas branché : on ne veut ni erreur ni ligne d'échec en base.
  if (!url || !secret || !racine) return;

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      slug: true,
      title: true,
      dek: true,
      tags: true,
      publishedAt: true,
      rubrique: { select: { slug: true, name: true } },
      author: { select: { name: true } },
      coverAsset: { select: { url: true } },
    },
  });
  if (!article) return;

  const ligne = await prisma.diffusionArticle.create({
    data: { articleId: article.id, statut: "en_attente" },
    select: { id: true },
  });

  await envoyer(ligne.id, article as ArticleADiffuser, url, secret, racine);
}

/** Relance manuelle depuis le Studio, sur une ligne déjà existante. */
export async function relancerDiffusion(diffusionId: string): Promise<{ ok: boolean; erreur?: string }> {
  const url = process.env.DIFFUSION_WEBHOOK_URL;
  const secret = process.env.DIFFUSION_WEBHOOK_SECRET;
  const racine = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url || !secret || !racine) return { ok: false, erreur: "Diffusion non configurée sur le serveur." };

  const ligne = await prisma.diffusionArticle.findUnique({
    where: { id: diffusionId },
    select: {
      id: true,
      article: {
        select: {
          id: true,
          slug: true,
          title: true,
          dek: true,
          tags: true,
          publishedAt: true,
          rubrique: { select: { slug: true, name: true } },
          author: { select: { name: true } },
          coverAsset: { select: { url: true } },
        },
      },
    },
  });
  if (!ligne) return { ok: false, erreur: "Annonce introuvable." };

  const r = await envoyer(ligne.id, ligne.article as ArticleADiffuser, url, secret, racine);
  return r.ok ? { ok: true } : { ok: false, erreur: r.erreur };
}

async function envoyer(
  diffusionId: string,
  article: ArticleADiffuser,
  url: string,
  secret: string,
  racine: string
): Promise<{ ok: boolean; erreur?: string }> {
  const corps = JSON.stringify(construirePayload(article, racine));

  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // L'automate rejette ce qui n'est pas signé de ce secret.
        "X-A4A-Signature": signer(corps, secret),
      },
      body: corps,
      signal: AbortSignal.timeout(DELAI_MS),
    });

    const ok = reponse.ok;
    await prisma.diffusionArticle.update({
      where: { id: diffusionId },
      data: {
        statut: ok ? "envoyee" : "echec",
        codeHttp: reponse.status,
        erreur: ok ? null : `L'automate a répondu ${reponse.status}.`,
        essais: { increment: 1 },
        envoyeeAt: ok ? new Date() : undefined,
      },
    });
    if (!ok) console.error(`[diffusion] ${article.slug} — HTTP ${reponse.status}`);
    return ok ? { ok: true } : { ok: false, erreur: `L'automate a répondu ${reponse.status}.` };
  } catch (e) {
    // Délai dépassé, DNS, automate éteint. Le motif est écrit tel quel : c'est
    // ce que la rédaction lira dans le Studio pour savoir qui appeler.
    const motif = e instanceof Error ? e.message : String(e);
    await prisma.diffusionArticle.update({
      where: { id: diffusionId },
      data: { statut: "echec", erreur: motif.slice(0, 300), essais: { increment: 1 } },
    });
    console.error(`[diffusion] ${article.slug} — ${motif}`);
    return { ok: false, erreur: motif };
  }
}
