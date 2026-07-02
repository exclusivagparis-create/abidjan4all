import type { NextAuthConfig } from "next-auth";

/**
 * Partie edge-safe de la config Auth.js : importée par le middleware,
 * elle ne doit référencer ni Prisma ni bcrypt (le provider credentials
 * complet vit dans auth.ts, côté Node).
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
