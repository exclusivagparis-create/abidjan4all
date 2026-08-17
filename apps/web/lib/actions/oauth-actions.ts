"use server";

import { redirect } from "next/navigation";
import { prisma } from "@a4a/db";
import { auth, signOut, STUDIO_ROLES } from "@/auth";
import { autorise, SCOPE_IDS, type ApiIdentity, type Scope } from "@/lib/api-auth";
import { creerCode } from "@/lib/oauth";

/**
 * Traite le clic « Autoriser » de l'écran de consentement : émet un code à
 * usage unique et renvoie le navigateur vers l'application.
 *
 * Toutes les vérifications de la page sont refaites ici. La page n'est qu'un
 * affichage ; c'est cette action qui décide, et rien de ce qui vient du
 * formulaire n'est cru sur parole — client, adresse de retour et portées sont
 * revalidés en base et contre le rôle réel du compte.
 */
export async function autoriserAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || !STUDIO_ROLES.includes(session.user.role as (typeof STUDIO_ROLES)[number])) {
    redirect("/login?next=/admin");
  }

  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { id: true, redirectUris: true },
  });
  // Client inconnu ou adresse de retour non enregistrée : on ne redirige nulle
  // part, on renvoie sur une page neutre. Rediriger vers une adresse non
  // vérifiée serait exactement ce que la vérification empêche.
  if (!client || !client.redirectUris.includes(redirectUri) || !codeChallenge) {
    redirect("/oauth/authorize?erreur=demande_invalide");
  }

  // Le rôle est relu en base : le jeton de session pourrait dater d'avant une
  // rétrogradation.
  const compte = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });
  if (!compte || !STUDIO_ROLES.includes(compte.role as (typeof STUDIO_ROLES)[number])) {
    redirect("/login?next=/admin");
  }

  const moi: ApiIdentity = {
    userId: compte.id,
    name: compte.name,
    role: compte.role,
    scopes: [...(SCOPE_IDS as Scope[])],
    via: "session",
  };

  // Portées cochées, filtrées par ce que le rôle autorise réellement. Un champ
  // ajouté à la main dans le formulaire ne donne donc rien de plus.
  const cochées = formData
    .getAll("scopes")
    .map(String)
    .filter((s): s is Scope => (SCOPE_IDS as string[]).includes(s))
    .filter((s) => autorise(moi, s));

  const destination = new URL(redirectUri);
  if (cochées.length === 0) {
    destination.searchParams.set("error", "access_denied");
    destination.searchParams.set("error_description", "Aucune portée accordée.");
    if (state) destination.searchParams.set("state", state);
    redirect(destination.toString());
  }

  const code = await creerCode({
    oauthClientId: client.id,
    userId: compte.id,
    redirectUri,
    scopes: cochées,
    codeChallenge,
    method: "S256",
  });

  destination.searchParams.set("code", code);
  if (state) destination.searchParams.set("state", state);
  redirect(destination.toString());
}

/**
 * « Changer de compte » : déconnecte, puis renvoie vers l'écran de connexion
 * en gardant la demande d'autorisation en cours. Sans cela, l'utilisateur
 * arrivé avec le mauvais compte doit refaire tout le parcours depuis Claude.
 *
 * La destination est reconstruite à partir des paramètres du formulaire plutôt
 * que reprise telle quelle : une URL de retour arbitraire glissée ici ferait de
 * la page un tremplin de redirection.
 */
export async function changerDeCompteAction(formData: FormData): Promise<void> {
  const params = new URLSearchParams();
  for (const clé of [
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
  ]) {
    const valeur = formData.get(clé);
    if (typeof valeur === "string" && valeur) params.set(clé, valeur);
  }
  params.set("response_type", "code");

  await signOut({ redirectTo: `/login?next=${encodeURIComponent(`/oauth/authorize?${params}`)}` });
}

/** Clic « Refuser » : on repart vers l'application, sans rien accorder. */
export async function refuserAction(formData: FormData): Promise<void> {
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const state = String(formData.get("state") ?? "");

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { redirectUris: true },
  });
  if (!client || !client.redirectUris.includes(redirectUri)) redirect("/");

  const destination = new URL(redirectUri);
  destination.searchParams.set("error", "access_denied");
  destination.searchParams.set("error_description", "Demande refusée par l'utilisateur.");
  if (state) destination.searchParams.set("state", state);
  redirect(destination.toString());
}
