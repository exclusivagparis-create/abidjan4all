import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@a4a/db";
import { authConfig } from "./auth.config";

/** Identifiants corrects mais adresse e-mail jamais confirmée. */
export class EmailNonVerifieError extends CredentialsSignin {
  code = "email_non_verifie";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Inscription libre non confirmée : mot de passe bon, mais adresse non
        // prouvée. Erreur distincte pour ne pas laisser croire à une faute de
        // frappe — le contrôle n'est levé qu'après le clic sur le lien reçu.
        if (!user.emailVerified) throw new EmailNonVerifieError();

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});

/** Rôles autorisés à entrer dans le back-office. */
export const STUDIO_ROLES = ["journalist", "editor", "admin"] as const;
/** Rôles autorisés à programmer/publier (workflow éditorial). */
export const PUBLISH_ROLES = ["editor", "admin"] as const;
