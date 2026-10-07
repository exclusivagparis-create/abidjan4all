import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const STUDIO_ROLES = ["journalist", "editor", "admin", "ad_manager"];

// Instance edge-safe (sans Prisma/bcrypt) : suffit à lire le JWT de session.
const { auth } = NextAuth(authConfig);

/**
 * Ce fichier lit le rôle dans le JETON, et c'est assumé.
 *
 * Le rôle y est inscrit à la connexion et jamais rafraîchi : celui que lit ce
 * middleware peut donc avoir trente jours de retard sur la base. Il tourne sur
 * le runtime edge et n'atteindra jamais Prisma — il n'y a pas de correctif
 * possible ici, seulement un choix à expliciter.
 *
 * Le choix : ce middleware est un CONFORT DE NAVIGATION. Il évite d'afficher
 * une page du Studio à qui n'a rien à y faire, et renvoie la régie vers son
 * propre périmètre. Il ne décide de rien.
 *
 * La frontière réelle se tient à deux endroits, qui relisent tous deux le rôle
 * en base par `exigerRole` (lib/garde-role.ts) :
 *
 * — `app/admin/layout.tsx`, qui enveloppe TOUTES les pages du Studio ;
 * — les gardes de `lib/actions`, car un layout ne protège pas une action
 *   serveur, appelée directement par son identifiant.
 *
 * Autrement dit : un compte rétrogradé pourrait, dans le pire des cas, voir le
 * middleware le laisser passer — et se faire refuser une fraction de seconde
 * plus tard par le layout, avant qu'aucune donnée ne s'affiche.
 */

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const login = new URL("/login", req.nextUrl);
      login.searchParams.set("next", pathname);
      return Response.redirect(login);
    }
    if (!STUDIO_ROLES.includes(user.role)) {
      return Response.redirect(new URL("/", req.nextUrl));
    }
    // Gestionnaire Régie : accès Studio limité à la régie publicitaire
    // (plus la page d'aide, commune à toute l'équipe).
    if (user.role === "ad_manager" && !pathname.startsWith("/admin/ads") && pathname !== "/admin/aide") {
      return Response.redirect(new URL("/admin/ads", req.nextUrl));
    }
  }

  // Expose le chemin aux composants serveur : la mesure d'audience en a besoin
  // et Next ne le transmet pas autrement. Un en-tête de requête, jamais renvoyé
  // au navigateur.
  const enTetes = new Headers(req.headers);
  enTetes.set("x-a4a-path", pathname);
  return NextResponse.next({ request: { headers: enTetes } });
});

export const config = {
  // Tout le site SAUF : l'API (webhooks PSP — surtout ne pas les gêner), les
  // fichiers de Next, les téléversements et tout ce qui porte une extension.
  matcher: ["/((?!api|_next/static|_next/image|uploads|.*\\.[a-zA-Z0-9]+$).*)"],
};
