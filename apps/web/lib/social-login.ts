/**
 * Connexion sociale — rattachement d'un compte Google, Facebook ou Apple.
 *
 * Toute la difficulté tient en une question : quand un compte tiers a-t-il le
 * droit de prendre la main sur un compte Abidjan4All existant ?
 *
 * Rattacher sur la seule foi d'une adresse e-mail est le moyen classique de
 * voler un compte : il suffit de créer chez un fournisseur laxiste un compte
 * portant l'adresse de la victime. La règle retenue est donc double.
 *
 *   1. Le fournisseur doit AFFIRMER que l'adresse est vérifiée. Google et Apple
 *      le font ; Facebook ne le dit pas, ses connexions ne rattachent donc
 *      jamais un compte existant.
 *   2. Un compte de la rédaction (journaliste, rédaction en chef,
 *      administration, régie) n'est JAMAIS rattaché automatiquement. Ces
 *      comptes publient et gèrent l'argent du site ; ils entrent par mot de
 *      passe. Le rattachement se fait depuis leurs paramètres, en connaissance
 *      de cause.
 *
 * Une fois le lien créé, il est enregistré dans Account : les connexions
 * suivantes passent par l'identifiant du fournisseur, sans repasser par
 * l'adresse e-mail.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@a4a/db";
import { STUDIO_ROLES } from "@/lib/roles";

/** Nom du cookie portant le jeton d'intention de rattachement. */
export const COOKIE_INTENTION = "a4a_lien_social";

/** Durée de vie d'une intention : le temps d'un aller-retour chez Google. */
export const INTENTION_TTL_MS = 10 * 60 * 1000;

/**
 * Fournisseurs pris en charge, et leurs variables d'environnement.
 *
 * Google seul, à la demande de la rédaction. Facebook exigeait une revue de
 * l'application par Meta pour obtenir l'adresse e-mail, et Apple un compte
 * développeur payant avec un secret à regénérer tous les six mois. La liste
 * reste une liste : en rajouter un tient à une ligne ici, une dans auth.ts et
 * un logo.
 */
export const FOURNISSEURS = [
  {
    id: "google",
    label: "Google",
    /**
     * Les variables sont nommées EN TOUTES LETTRES, jamais lues par une clé
     * calculée. Next.js remplace `process.env.NOM` au moment de la
     * compilation ; un accès de la forme `process.env[variable]` échappe à ce
     * traitement et renvoie `undefined` dans le bundle de production — tout en
     * marchant parfaitement en développement. Le piège est silencieux : les
     * boutons disparaissent en production sans la moindre erreur.
     */
    configure: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
] as const;

export type FournisseurId = (typeof FOURNISSEURS)[number]["id"];

/**
 * Fournisseurs réellement utilisables : ceux dont les deux identifiants sont
 * renseignés. Permet de n'afficher aucun bouton tant que rien n'est configuré.
 */
export function fournisseursActifs(): { id: FournisseurId; label: string }[] {
  return FOURNISSEURS.filter((f) => f.configure()).map((f) => ({ id: f.id, label: f.label }));
}

/**
 * Le fournisseur affirme-t-il que l'adresse est vérifiée ?
 *
 * Google porte la revendication `email_verified`. Le contrôle reste écrit par
 * fournisseur, et répond NON par défaut : le jour où un autre fournisseur est
 * ajouté, il faut décider explicitement s'il est digne de confiance — l'oubli
 * penche du côté prudent.
 */
export function emailVerifieParFournisseur(
  provider: string,
  profile: Record<string, unknown> | undefined
): boolean {
  if (!profile) return false;
  if (provider === "google") {
    const v = profile.email_verified;
    return v === true || v === "true";
  }
  return false;
}

export type RaisonRefus =
  | "email_absent"
  | "verif_impossible"
  | "compte_redaction"
  | "deja_lie"
  | "lien_autre_compte";

// ---------------------------------------------------------------------------
// Rattachement délibéré, depuis les paramètres
// ---------------------------------------------------------------------------

function empreinte(v: string): string {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

/** Crée une intention et renvoie le jeton à déposer dans le cookie. */
export async function creerIntentionRattachement(userId: string): Promise<string> {
  const jeton = randomBytes(32).toString("base64url");
  await prisma.accountLinkIntent.create({
    data: {
      tokenHash: empreinte(jeton),
      userId,
      expiresAt: new Date(Date.now() + INTENTION_TTL_MS),
    },
  });
  return jeton;
}

/**
 * Consomme une intention. Renvoie l'identifiant du titulaire, ou null si le
 * jeton est inconnu, déjà utilisé ou périmé.
 *
 * Un null n'est pas traité comme une erreur par l'appelant : il retombe sur la
 * connexion sociale ordinaire. C'est voulu — un cookie resté d'une tentative
 * précédente ne doit pas empêcher de se connecter normalement.
 */
export async function consommerIntentionRattachement(jeton: string): Promise<string | null> {
  const hash = empreinte(jeton);
  return prisma.$transaction(async (tx) => {
    const ligne = await tx.accountLinkIntent.findUnique({
      where: { tokenHash: hash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
    if (!ligne || ligne.usedAt || ligne.expiresAt.getTime() < Date.now()) return null;
    await tx.accountLinkIntent.update({ where: { id: ligne.id }, data: { usedAt: new Date() } });
    return ligne.userId;
  });
}

/**
 * Rattache un compte tiers à un compte précis, sur décision de son titulaire.
 *
 * Le contrôle « jamais un compte de la rédaction » ne s'applique pas ici : il
 * protège contre un rattachement subi, or celui-ci est demandé depuis une
 * session authentifiée. Restent deux garde-fous : ne pas voler un compte tiers
 * déjà rattaché ailleurs, et ne pas rattacher une adresse qui appartient déjà à
 * un autre membre — ce qui détournerait ses futures connexions.
 */
export async function rattacherDeliberement(input: {
  userId: string;
  provider: string;
  providerAccountId: string;
  email: string | null | undefined;
}): Promise<Resolution> {
  const { userId, provider, providerAccountId } = input;

  const dejaLie = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { userId: true },
  });
  if (dejaLie) {
    // Déjà rattaché à ce compte-ci : rien à faire, on laisse entrer.
    if (dejaLie.userId === userId) {
      const u = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, role: true },
      });
      return { ok: true, user: u, nouveau: false };
    }
    return { ok: false, raison: "deja_lie" };
  }

  const email = input.email?.trim().toLowerCase();
  if (email) {
    const porteur = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (porteur && porteur.id !== userId) return { ok: false, raison: "lien_autre_compte" };
  }

  const moi = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!moi) return { ok: false, raison: "deja_lie" };

  await prisma.account.create({ data: { provider, providerAccountId, userId } });
  return { ok: true, user: moi, nouveau: false };
}

export type Resolution =
  | { ok: true; user: { id: string; name: string; role: string }; nouveau: boolean }
  | { ok: false; raison: RaisonRefus };

/**
 * Résout la connexion sociale : trouve ou crée le compte Abidjan4All
 * correspondant, en appliquant la politique ci-dessus.
 */
export async function resoudreConnexionSociale(input: {
  provider: string;
  providerAccountId: string;
  email: string | null | undefined;
  nom: string | null | undefined;
  avatar: string | null | undefined;
  profile: Record<string, unknown> | undefined;
}): Promise<Resolution> {
  const { provider, providerAccountId } = input;

  // 1. Lien déjà établi : on entre directement, sans repasser par l'e-mail.
  const lien = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { user: { select: { id: true, name: true, role: true } } },
  });
  if (lien) return { ok: true, user: lien.user, nouveau: false };

  const email = input.email?.trim().toLowerCase();
  if (!email) return { ok: false, raison: "email_absent" };

  const verifie = emailVerifieParFournisseur(provider, input.profile);
  const existant = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, emailVerified: true, avatarUrl: true },
  });

  // 2. Personne ne détient cette adresse : on crée un compte lecteur.
  if (!existant) {
    const nom = input.nom?.trim() || email.split("@")[0] || "Membre";
    const cree = await prisma.user.create({
      data: {
        email,
        name: nom.slice(0, 80),
        role: "reader",
        avatarUrl: input.avatar ?? null,
        // Sans affirmation du fournisseur, l'adresse reste non vérifiée : le
        // compte fonctionne par connexion sociale, mais ne débloque pas la
        // connexion par mot de passe (il n'en a d'ailleurs aucun).
        emailVerified: verifie ? new Date() : null,
        accounts: { create: { provider, providerAccountId } },
      },
      select: { id: true, name: true, role: true },
    });
    return { ok: true, user: cree, nouveau: true };
  }

  // 3. L'adresse est déjà prise : rattacher revient à ouvrir ce compte.
  if (!verifie) return { ok: false, raison: "verif_impossible" };
  if (STUDIO_ROLES.includes(existant.role as (typeof STUDIO_ROLES)[number])) {
    return { ok: false, raison: "compte_redaction" };
  }

  await prisma.$transaction([
    prisma.account.create({ data: { provider, providerAccountId, userId: existant.id } }),
    prisma.user.update({
      where: { id: existant.id },
      data: {
        // Le fournisseur vient de prouver l'adresse : un compte créé mais
        // jamais confirmé par e-mail devient utilisable.
        emailVerified: existant.emailVerified ?? new Date(),
        avatarUrl: existant.avatarUrl ?? input.avatar ?? null,
      },
    }),
  ]);

  return {
    ok: true,
    user: { id: existant.id, name: existant.name, role: existant.role },
    nouveau: false,
  };
}
