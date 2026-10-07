/**
 * Le rôle, relu en base — jamais le jeton de session seul.
 *
 * La stratégie de session est « jwt » : le rôle y est inscrit à la connexion,
 * par le callback `jwt`, et plus jamais rafraîchi. Il voyage donc dans le
 * jeton pendant toute sa durée de vie, trente jours par défaut.
 *
 * Conséquence, constatée lors du contrôle du 7 octobre 2026 : un journaliste
 * rétrogradé ou parti conservait ses droits dans le Studio jusqu'à
 * l'expiration de son jeton. Rien dans le schéma ne permet de suspendre un
 * compte — couper l'accès à quelqu'un passe par son rôle — si bien que le
 * geste de l'administration restait sans effet immédiat, précisément quand il
 * compte le plus : le jour du départ.
 *
 * Vingt-trois points de garde lisaient le jeton, huit modules relisaient déjà
 * la base avec leur propre copie du code. Cette fonction est désormais la
 * seule à savoir répondre, et le compte supprimé est refusé par la même
 * occasion : son jeton restait sinon parfaitement valable.
 *
 * Le middleware, lui, continue de lire le jeton : il tourne sur le runtime
 * edge et n'atteindra jamais Prisma. Ce n'est pas un trou à condition de
 * l'écrire — le middleware est un confort de navigation, la frontière réelle
 * se tient ici et dans le layout du Studio.
 */
import "server-only";
import { cache } from "react";
import { prisma } from "@a4a/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleAdmis } from "@/lib/roles";

/** Ce qu'une garde réussie rend : de quoi attribuer et journaliser. */
export interface Identite {
  id: string;
  name: string;
  role: string;
}

/**
 * Lecture du compte, mémorisée pour la durée de la requête.
 *
 * Le layout du Studio, la page affichée et parfois un composant appellent
 * tous une garde. Sans mémorisation, chaque appel vaudrait une requête de
 * plus ; avec, la base est interrogée UNE fois par requête HTTP — et le coût
 * cesse d'être un argument contre le fait de relire le rôle partout.
 *
 * `cache` de React est lié à la requête en cours : rien ne survit d'un
 * visiteur à l'autre, ni d'une requête à la suivante. Une rétrogradation
 * prend donc effet au rechargement suivant.
 */
const compteDeLaRequete = cache(async (id: string) =>
  prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } })
);

/**
 * Identité de l'appelant si son rôle — celui de la BASE — figure parmi
 * `roles`, sinon `null`.
 *
 * Rend `null` plutôt que de rediriger : les appelants refusent de quatre
 * façons différentes selon l'endroit (message d'erreur, liste vide, retour
 * nul, redirection vers la page de connexion), et c'est à eux de choisir.
 */
/**
 * Identite de l appelant connecte, relue en base, sans condition de role.
 *
 * Sert a l API : `identifier` (lib/api-auth.ts) accepte aussi la session du
 * navigateur, et recopiait alors le role du jeton. Toutes les routes qui
 * verifient un role apres `identifier` heritaient donc du retard du jeton —
 * y compris la suppression d articles par lot.
 */
export async function identiteEnBase(): Promise<Identite | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return (await compteDeLaRequete(session.user.id)) ?? null;
}

export async function exigerRole(roles: readonly string[]): Promise<Identite | null> {
  const moi = await identiteEnBase();
  if (!moi || !roleAdmis(moi.role, roles)) return null;
  return moi;
}

/**
 * Variante qui refuse elle-même, pour les pages et modules du Studio.
 *
 * Huit modules portaient chacun leur copie de ces six lignes — ils étaient
 * les seuls à relire la base, et c'est de là que vient ce correctif. Leur
 * copie distinguait deux refus, distinction qui valait d'être gardée :
 *
 * — pas connecté : on envoie vers la page de connexion AVEC l'adresse de
 *   retour, pour revenir où l'on voulait aller ;
 * — rôle insuffisant : on envoie à l'accueil du Studio, car la personne y a
 *   bien sa place, simplement pas sur cette page-là.
 *
 * Les confondre renverrait une rédactrice en chef sur un formulaire de
 * connexion alors qu'elle est déjà connectée.
 */
export async function exigerRoleOuRediriger(
  roles: readonly string[],
  /** Page à rouvrir après connexion, par exemple « /admin/ads ». */
  retour: string
): Promise<Identite> {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=${retour}`);

  const moi = await compteDeLaRequete(session.user.id);
  if (!moi || !roleAdmis(moi.role, roles)) redirect("/admin");

  return moi;
}