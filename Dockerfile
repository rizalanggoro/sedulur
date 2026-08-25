# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# nitro wajib bind 0.0.0.0 agar bisa diakses dari luar container
ENV HOST=0.0.0.0
ENV PORT=3000
# drizzle-orm + pg (prod deps) untuk script migrasi saat start
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY drizzle ./drizzle
COPY scripts/migrate.mjs ./scripts/migrate.mjs
EXPOSE 3000
# migrasi otomatis (idempoten) sebelum server menyala
CMD ["sh", "-c", "node scripts/migrate.mjs && node .output/server/index.mjs"]
