"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { FOURNISSEURS, type FournisseurId } from "@/lib/social-login";

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
