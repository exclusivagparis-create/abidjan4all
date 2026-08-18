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
import { prisma } from "@a4a/db";
import { STUDIO_ROLES } from "@/lib/roles";

/** Fournisseurs pris en charge, et leurs variables d'environnement. */
export const FOURNISSEURS = [
  { id: "google", label: "Google", envId: "GOOGLE_CLIENT_ID", envSecret: "GOOGLE_CLIENT_SECRET" },
  { id: "facebook", label: "Facebook", envId: "FACEBOOK_CLIENT_ID", envSecret: "FACEBOOK_CLIENT_SECRET" },
  { id: "apple", label: "Apple", envId: "APPLE_CLIENT_ID", envSecret: "APPLE_CLIENT_SECRET" },
] as const;

export type FournisseurId = (typeof FOURNISSEURS)[number]["id"];

/**
 * Fournisseurs réellement utilisables : ceux dont les deux identifiants sont
 * renseignés. Permet de démarrer avec Google seul sans afficher des boutons
 * qui mèneraient à une page d'erreur.
 */
export function fournisseursActifs(): { id: FournisseurId; label: string }[] {
  return FOURNISSEURS.filter((f) => process.env[f.envId] && process.env[f.envSecret]).map((f) => ({
    id: f.id,
    label: f.label,
  }));
}

/**
 * Le fournisseur affirme-t-il que l'adresse est vérifiée ?
 *
 * Google et Apple portent la revendication `email_verified` (Apple la renvoie
 * parfois sous forme de chaîne « true »). Facebook ne la fournit pas : dans le
 * doute, on répond non — c'est le sens de ce garde-fou.
 */
export function emailVerifieParFournisseur(
  provider: string,
  profile: Record<string, unknown> | undefined
): boolean {
  if (!profile) return false;
  if (provider === "google" || provider === "apple") {
    const v = profile.email_verified;
    return v === true || v === "true";
  }
  return false;
}

export type RaisonRefus = "email_absent" | "verif_impossible" | "compte_redaction";

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
