FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY web/package.json web/package.json
COPY server/package.json server/package.json

RUN corepack enable \
  && corepack prepare pnpm@10.15.1 --activate \
  && pnpm install --frozen-lockfile

COPY shared shared
COPY web web
COPY server server

RUN pnpm build

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/app/data

EXPOSE 8787

CMD ["pnpm", "--filter", "@ss/server", "start"]
