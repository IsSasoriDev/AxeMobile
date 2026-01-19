# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Static files
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config (CORRECT PATH)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
