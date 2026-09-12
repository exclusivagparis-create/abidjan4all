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

## Déploiement (VPS IONOS)

### Première installation

```bash
# sur le serveur (Docker + compose v2 installés)
git clone <repo> /root/abidjan4all && cd /root/abidjan4all
cp .env.example .env    # renseigner POSTGRES_PASSWORD, AUTH_SECRET,
                        # NEXT_PUBLIC_SITE_URL, AI_API_KEY, clés PSP,
                        # clés VAPID (npx web-push generate-vapid-keys)…
cd infra/docker && docker compose --env-file ../../.env -f docker-compose.prod.yml up -d --build
```

### Mise à jour

```bash
cd /root/abidjan4all && git pull --ff-only
cd infra/docker && docker compose --env-file ../../.env -f docker-compose.prod.yml up -d --build
```

**Lancer Compose depuis `infra/docker`, jamais depuis la racine du dépôt.**
Compose tire le nom du projet du dossier courant. La pile en production
s'appelle `docker`, d'après `infra/docker`. Depuis la racine, Compose en
déduirait le projet `abidjan4all` et démarrerait une *seconde* pile à côté de
la première, sur les mêmes ports, au lieu de mettre à jour celle qui tourne.

**`--env-file ../../.env` est obligatoire** : le `.env` vit à la racine du
dépôt, pas dans `infra/docker`. Sans ce drapeau, Compose s'arrête sur
`POSTGRES_PASSWORD is missing a value`.

Contrôle après coup — les deux conteneurs applicatifs doivent être fraîchement
redémarrés, et aucun conteneur d'un autre projet n'apparaître :

```bash
docker ps --filter 'label=com.docker.compose.project=docker'
```

Le service `migrate` applique les migrations Prisma avant le démarrage du web.
Alertes Web Push (DF-04) : sans clés VAPID, les alertes sont désactivées sans
casser le site ; l'opt-in vit dans l'espace membre, l'envoi part à la
publication (Studio et scheduler), filtré par les rubriques suivies.
TLS et cache : le conteneur `caddy` termine TLS devant le port 3000 (voir
`infra/docker/Caddyfile`) — l'accueil est rendu à la requête, à mettre en
cache CDN court (30-60 s) à l'échelle.
CI : `.github/workflows/ci.yml` — type-check, build sur un PostgreSQL de
service et construction de l'image Docker, sur chaque pull request et sur
chaque push vers `main`.

## Feuille de route (cahier des charges)

DF-01 Front-End/UX · DF-02 CMS/Back-End · DF-03 Monétisation (A4A+, paywall, pub, marketplace) ·
DF-04 Communauté · DF-05 Contenus (13 rubriques, live-blog, e-learning, i18n) · DF-06 SEO/Distribution.
