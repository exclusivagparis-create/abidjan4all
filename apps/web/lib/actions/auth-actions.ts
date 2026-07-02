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
      return "E-mail ou mot de passe invalide.";
    }
    throw error; // NEXT_REDIRECT (connexion réussie) et erreurs inattendues
  }
  return undefined;
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
