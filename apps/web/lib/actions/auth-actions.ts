"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

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
