# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching.
# Build context is the repository root (see .github/workflows/docker-publish.yml).
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps 2>/dev/null || npm install 2>/dev/null || true

# Copy the files required to build the SPA
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY tailwind.config.ts postcss.config.js components.json ./
COPY src/ ./src/
COPY public/ ./public/

# Produce the static production bundle
RUN npx vite build

# ---------- Production stage ----------
FROM nginx:alpine

# Serve the compiled SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace the default Nginx site with our SPA-aware config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY axemobile-main/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
