# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json ./

# Install dependencies (skip native/optional deps that fail in Docker)
RUN npm install --ignore-scripts --no-optional 2>/dev/null || npm install --legacy-peer-deps --ignore-scripts 2>/dev/null || true

# Copy source files needed for build
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.app.json ./
COPY tsconfig.node.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build the app (production mode)
RUN npx vite build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY axemobile-main/nginx.conf /etc/nginx/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
