import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const STUDIO_ROLES = ["journalist", "editor", "admin"];

// Instance edge-safe (sans Prisma/bcrypt) : suffit à lire le JWT de session.
const { auth } = NextAuth(authConfig);

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
  }
});

export const config = { matcher: ["/admin/:path*"] };
