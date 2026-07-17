# syntax=docker/dockerfile:1
# Image de production Abidjan4All (apps/web) — build depuis la racine du monorepo :
#   docker build -f apps/web/Dockerfile -t abidjan4all-web .

# ---------- deps + build ----------
FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
# openssl : requis par le moteur Prisma sur debian-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/
COPY services/payments/package.json services/payments/
COPY services/ai/package.json services/ai/
RUN pnpm install --frozen-lockfile

COPY . .

# le client Prisma (moteur linux) est généré dans l'image
RUN pnpm --filter @a4a/db exec prisma generate

# le build n'interroge pas la base (pages dynamiques / flux tolérants),
# mais Prisma exige une DATABASE_URL syntaxiquement valide
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
# active la sortie standalone (next.config.ts)
ENV DOCKER_BUILD=1
# NEXT_PUBLIC_* : inlinés dans le bundle client AU BUILD — le .env chargé au
# runtime par compose ne suffit pas pour le navigateur. Passés en build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_GA4_ID
# Repli localhost si l'arg est vide (cible migrate, CI) : une chaîne vide
# n'est pas nullish et casserait new URL() pendant le build.
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-http://localhost:3000} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-} \
    NEXT_PUBLIC_GA4_ID=${NEXT_PUBLIC_GA4_ID:-}
RUN pnpm --filter @a4a/web build

# La sortie standalone ne trace pas le client Prisma généré (pnpm + monorepo,
# vérifié en prod : aucun .prisma/ ni moteur .so dans l'image) — copie
# explicite du client et de son moteur dans l'arborescence embarquée, où la
# résolution Node les trouve depuis les chunks (/app/node_modules).
RUN CLIENT=$(ls -d node_modules/.pnpm/@prisma+client@*/node_modules) \
  && mkdir -p apps/web/.next/standalone/node_modules/@prisma \
  && cp -rL "$CLIENT/@prisma/client" apps/web/.next/standalone/node_modules/@prisma/ \
  && cp -rL "$CLIENT/.prisma" apps/web/.next/standalone/node_modules/

# Même problème pour geoip-lite (déclaré serverExternalPackages, donc non
# empaqueté) : ni le module ni ses bases `.dat` ne sont tracés — vérifié sur la
# sortie standalone. Sans cette copie, le pays des visites resterait vide.
#
# Les bases « villes » (108 Mo sur 111) sont retirées : seul le pays est
# exploité. Vérifié que la recherche fonctionne sans elles.
# Le `test -s` fait échouer le build plutôt que de livrer des pays vides.
RUN GEO=$(ls -d node_modules/.pnpm/geoip-lite@*/node_modules/geoip-lite) \
  && cp -rL "$GEO" apps/web/.next/standalone/node_modules/geoip-lite \
  && rm -f apps/web/.next/standalone/node_modules/geoip-lite/data/geoip-city*.dat \
  && test -s apps/web/.next/standalone/node_modules/geoip-lite/data/geoip-country.dat

# ---------- runtime ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r a4a && useradd -r -g a4a a4a

# sortie standalone : server.js + node_modules tracés (Prisma inclus)
COPY --from=builder --chown=a4a:a4a /app/apps/web/.next/standalone ./
COPY --from=builder --chown=a4a:a4a /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=a4a:a4a /app/apps/web/public ./apps/web/public

# Le client Prisma bundlé cherche le moteur relativement aux chunks
# (/app/apps/web/.prisma/client, constaté en prod) : lien vers la copie
# embarquée + override explicite du chemin du moteur.
RUN ln -s /app/node_modules/.prisma /app/apps/web/.prisma
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node

# Médiathèque : répertoire d'uploads persistant (volume compose) — créé avec
# le bon propriétaire pour que le volume nommé en hérite au premier montage.
RUN mkdir -p /data/uploads && chown -R a4a:a4a /data
ENV UPLOADS_DIR=/data/uploads

USER a4a
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
