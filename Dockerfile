# =============================================================================
# IND Appointments Tracker - Production Dockerfile
# =============================================================================
# Multi-stage build optimized for size, security, and caching.
#
# Build:
#   docker build -t ind-appointments .
#   docker build --build-arg INSTALL_BROWSERS=true -t ind-appointments:full .
#
# Run:
#   docker run -p 3000:3000 --env-file .env -v ./data:/app/data ind-appointments
# =============================================================================

# ---------------------------------------------------------------------------
# Build argument: set INSTALL_BROWSERS=true to include Chromium for booking
# automation. Omit for a leaner image (~150MB vs ~550MB).
# ---------------------------------------------------------------------------
ARG INSTALL_BROWSERS=false

# ===========================================================================
# Stage 1: Install dependencies
# ===========================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Build tools required for native modules (better-sqlite3)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts=false && npm cache clean --force

# Rebuild better-sqlite3 for the Alpine target
RUN npm rebuild better-sqlite3

# ===========================================================================
# Stage 2: Build Next.js application
# ===========================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ===========================================================================
# Stage 3: Production runner
# ===========================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ARG INSTALL_BROWSERS

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Install runtime dependencies
# - libc6-compat: required by better-sqlite3
# - wget: used by HEALTHCHECK
# - tini: proper PID 1 / signal handling
RUN apk add --no-cache libc6-compat wget tini

# Conditionally install Chromium for Playwright booking automation
RUN if [ "$INSTALL_BROWSERS" = "true" ]; then \
      apk add --no-cache \
        chromium \
        nss \
        freetype \
        harfbuzz \
        ca-certificates \
        ttf-freefont; \
    fi

# When Chromium is installed via apk, tell Playwright where to find it
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/database ./database
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

# Create persistent directories
RUN mkdir -p /app/data /app/logs && \
    chown -R nextjs:nodejs /app/data /app/logs

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
