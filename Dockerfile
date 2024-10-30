# Based on https://github.com/vercel/next.js/tree/canary/examples/with-docker
# Use debian (bookworm) instead of alpine because 
FROM node:22-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# Don't need libc6-compat anymore because debian instead of alpine linux
# RUN apt-get install libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
COPY patches ./patches
# Use apt-get instead of apk add because debian
RUN apt update
RUN apt upgrade
RUN apt install -y python3-pip make g++
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i; \
  elif [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mv ./.env.local.docker ./.env.local
RUN cat ./.env.local

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

# Note this includes gcompat and is needed to supply ld-linux-aarch64.so.1 for onnxruntime-node
# Error: Error loading shared library ld-linux-aarch64.so.1: No such file or directory (needed by /root/recipes-app/node_modules/.pnpm/onnxruntime-node@1.14.0/node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/onnxruntime_binding.node)
# Don't need libc6-compat anymore because debian instead of alpine linux
# RUN apt-get install libc6-compat

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
# FROM base AS runner
# WORKDIR /app

# Install curl so we can health-check ourselves
RUN apt update
RUN apt install -y curl

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

# RUN addgroup --system --gid 1001 nodejs
# # Use 999 for uid instead of 1001 because debian (useradd warning: nextjs's uid 1001 is greater than SYS_UID_MAX 999)
# RUN adduser --system --uid 999 nextjs

# COPY --from=builder /app/public ./public

# # Set the correct permission for prerender cache
# RUN mkdir .next
# RUN chown nextjs:nodejs .next

# # Automatically leverage output traces to reduce image size
# # https://nextjs.org/docs/advanced-features/output-file-tracing
# COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
# can't use standalone for some reason...
ENV HOSTNAME="0.0.0.0"
CMD ["/usr/local/bin/pnpm", "start"]
# CMD ["node", "server.js"]
