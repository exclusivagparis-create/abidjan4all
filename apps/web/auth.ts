import NextAuth, { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Apple from "next-auth/providers/apple";
import bcrypt from "bcryptjs";
import { prisma } from "@a4a/db";
import { authConfig } from "./auth.config";
import { resoudreConnexionSociale } from "./lib/social-login";

/** Identifiants corrects mais adresse e-mail jamais confirmée. */
export class EmailNonVerifieError extends CredentialsSignin {
  code = "email_non_verifie";
}

/**
 * Fournisseurs tiers, enregistrés seulement si leurs identifiants existent.
 * Un fournisseur déclaré sans clés produit une page d'erreur à la première
 * tentative : mieux vaut qu'il n'apparaisse pas du tout. La rédaction peut
 * ainsi démarrer avec Google seul et ajouter les autres plus tard.
 */
function fournisseursTiers(): Provider[] {
  const liste: Provider[] = [];
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const { FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET } = process.env;
  const { APPLE_CLIENT_ID, APPLE_CLIENT_SECRET } = process.env;

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    liste.push(
      Google({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        // `consent` force le choix du compte : sans cela, un navigateur déjà
        // connecté à Google enchaîne sans rien demander, ce qui déroute quand
        // on veut justement changer de compte.
        authorization: { params: { prompt: "select_account" } },
      })
    );
  }
  if (FACEBOOK_CLIENT_ID && FACEBOOK_CLIENT_SECRET) {
    liste.push(Facebook({ clientId: FACEBOOK_CLIENT_ID, clientSecret: FACEBOOK_CLIENT_SECRET }));
  }
  if (APPLE_CLIENT_ID && APPLE_CLIENT_SECRET) {
    liste.push(Apple({ clientId: APPLE_CLIENT_ID, clientSecret: APPLE_CLIENT_SECRET }));
  }
  return liste;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Point d'entrée de toute connexion sociale. Le travail en base se fait
     * ici — côté Node — puis l'identité résolue est recopiée sur `user`, que
     * le callback `jwt` (edge-safe, dans auth.config.ts) lit sans rien savoir
     * de Prisma.
     *
     * Renvoyer une chaîne redirige : c'est ainsi qu'un refus revient sur la
     * page de connexion avec un motif explicable au lecteur.
     */
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;

      const resolution = await resoudreConnexionSociale({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        email: user.email ?? (profile?.email as string | undefined),
        nom: user.name ?? (profile?.name as string | undefined),
        avatar: user.image ?? null,
        profile: profile as Record<string, unknown> | undefined,
      });

      if (!resolution.ok) return `/login?raison=${resolution.raison}`;

      user.id = resolution.user.id;
      user.name = resolution.user.name;
      user.role = resolution.user.role;
      return true;
    },
  },
  providers: [
    ...fournisseursTiers(),
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

// Définis dans lib/roles.ts pour éviter un cycle d'import avec la connexion
// sociale ; réexportés ici, où tout le site va déjà les chercher.
export { STUDIO_ROLES, PUBLISH_ROLES, REGIE_ROLES } from "./lib/roles";
