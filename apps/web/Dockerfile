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
RUN pnpm --filter @a4a/web build

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

USER a4a
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
