# Abidjan4All — monorepo de production

Média numérique de la Côte d'Ivoire et de la diaspora (client : Exclusiv'AG).
Construit d'après le package de handoff `design_handoff_abidjan4all/` (README, DATA_MODEL.md, API_CONTRACTS.md, maquettes `design/*.dc.html`).

## Structure

```
apps/
  web/            # Next.js 15 (App Router, TypeScript, Tailwind 4) — front public (+ /admin à venir)
packages/
  ui/             # design system : tokens CSS (clair/sombre) + composants React
  db/             # schéma Prisma + client PostgreSQL exporté (@a4a/db)
  config/         # tsconfig partagés
services/
  ai/             # (placeholder) résumé, recherche générative, chatbot, modération
  payments/       # (placeholder) adaptateurs MoMo / Orange / Stripe / PayPal
infra/
  docker/         # docker-compose (PostgreSQL 15 + Redis 7)
```

## Démarrage

```bash
pnpm install
cp .env.example .env                     # puis renseigner DATABASE_URL
docker compose -f infra/docker/docker-compose.yml up -d   # ou PostgreSQL 15 natif
pnpm db:migrate                          # crée les tables (prisma migrate dev)
pnpm dev                                 # http://localhost:3000
```

La page `/design` reproduit le nuancier du design system pour comparaison avec
`design/Design System.dc.html` (source de vérité visuelle).

## Déploiement (IONOS VPS)

```bash
# sur le serveur (Docker + compose v2 installés)
git clone <repo> && cd abidjan4all
cp .env.example .env    # renseigner POSTGRES_PASSWORD, AUTH_SECRET,
                        # NEXT_PUBLIC_SITE_URL, AI_API_KEY, clés PSP…
docker compose -f infra/docker/docker-compose.prod.yml up -d --build
```

Le service `migrate` applique les migrations Prisma avant le démarrage du web.
TLS et cache : Cloudflare (ou caddy/traefik) devant le port 3000 — l'accueil est
rendu à la requête, à mettre en cache CDN court (30-60 s) à l'échelle.
CI : `.github/workflows/ci.yml` (type-check + build sur PostgreSQL de service +
image Docker) dès que le repo aura un remote GitHub.

## Feuille de route (cahier des charges)

DF-01 Front-End/UX · DF-02 CMS/Back-End · DF-03 Monétisation (A4A+, paywall, pub, marketplace) ·
DF-04 Communauté · DF-05 Contenus (13 rubriques, live-blog, e-learning, i18n) · DF-06 SEO/Distribution.
