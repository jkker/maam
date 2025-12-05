# Dockerfile for the maam monorepo

# 1. Base image with Node.js and pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

# 2. Install all dependencies and build the application
FROM base AS builder
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm build

# 4. Production image
FROM base AS runner
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
WORKDIR /app/server

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --ignore-scripts
CMD ["node", "dist/server.js"]

EXPOSE 3113
