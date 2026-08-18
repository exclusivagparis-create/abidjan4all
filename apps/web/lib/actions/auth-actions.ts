"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { prisma } from "@a4a/db";
import { auth, signIn, signOut } from "@/auth";
import {
  COOKIE_INTENTION,
  creerIntentionRattachement,
  FOURNISSEURS,
  INTENTION_TTL_MS,
  type FournisseurId,
} from "@/lib/social-login";

/**
 * Démarre un rattachement délibéré depuis les paramètres. L'intention est
 * enregistrée en base ; le cookie ne transporte que son jeton, et ne prouve
 * rien à lui seul.
 */
export async function rattacherCompteAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const demandé = String(formData.get("provider") ?? "");
  const fournisseur = FOURNISSEURS.find((f) => f.id === demandé);
  if (!fournisseur) return;

  const jeton = await creerIntentionRattachement(session.user.id);
  (await cookies()).set(COOKIE_INTENTION, jeton, {
    httpOnly: true,
    sameSite: "lax", // « lax » : le cookie doit survivre au retour depuis Google
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INTENTION_TTL_MS / 1000,
  });

  await signIn(fournisseur.id as FournisseurId, { redirectTo: "/parametres?lien=ok" });
}

/**
 * Détache un compte tiers. Refuse si c'était le dernier moyen d'entrer : un
 * membre inscrit par Google n'a pas de mot de passe, et se retrouverait dehors.
 */
export async function detacherCompteAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const provider = String(formData.get("provider") ?? "");
  const moi = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, accounts: { select: { id: true, provider: true } } },
  });
  if (!moi) return;

  const cible = moi.accounts.find((a) => a.provider === provider);
  if (!cible) return;

  if (!moi.passwordHash && moi.accounts.length === 1) {
    redirect("/parametres?lien=dernier_acces");
  }

  await prisma.account.delete({ where: { id: cible.id } });
  revalidatePath("/parametres");
  redirect("/parametres?lien=detache");
}

/**
 * Lance la connexion par un compte tiers. Le fournisseur est vérifié contre la
 * liste connue : sans ce contrôle, une valeur glissée dans le formulaire
 * pourrait viser n'importe quel point d'entrée d'Auth.js.
 *
 * La destination est restreinte aux chemins internes — une URL absolue ferait
 * de la page de connexion un tremplin de redirection vers un site tiers.
 */
export async function connexionSociale(formData: FormData): Promise<void> {
  const demandé = String(formData.get("provider") ?? "");
  const fournisseur = FOURNISSEURS.find((f) => f.id === demandé);
  if (!fournisseur) return;

  const suite = String(formData.get("next") ?? "");
  const destination = suite.startsWith("/") && !suite.startsWith("//") ? suite : "/espace-membre";

  await signIn(fournisseur.id as FournisseurId, { redirectTo: destination });
}

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      // `code` est porté par nos erreurs CredentialsSignin (voir auth.ts).
      if ((error as AuthError & { code?: string }).code === "email_non_verifie") {
        return "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien que nous vous avons envoyé à l'inscription.";
      }
      return "E-mail ou mot de passe invalide.";
    }
    throw error; // NEXT_REDIRECT (connexion réussie) et erreurs inattendues
  }
  return undefined;
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
