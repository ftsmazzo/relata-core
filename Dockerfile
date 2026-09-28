FROM node:20-alpine AS build
RUN npm install -g pnpm@9
WORKDIR /repo

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json

RUN pnpm install --frozen-lockfile=false

COPY tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY apps/server apps/server
COPY apps/dashboard apps/dashboard

RUN pnpm --filter @relata-core/shared-types build
RUN pnpm --filter @relata-core/server build
RUN pnpm --filter @relata-core/dashboard build

RUN pnpm --filter @relata-core/server deploy --prod /app/deploy/server

FROM node:20-alpine AS runner
RUN apk add --no-cache ffmpeg
WORKDIR /app

COPY --from=build /app/deploy/server ./
COPY --from=build /repo/apps/dashboard/dist ./public/dashboard

RUN mkdir -p /app/data/audio

ENV NODE_ENV=production
ENV AUDIO_STORAGE_DIR=/app/data/audio
EXPOSE 3000

CMD ["node", "dist/index.js"]
