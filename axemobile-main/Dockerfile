# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files FROM SUBDIR
COPY axemobile-main/package.json axemobile-main/package-lock.json ./

RUN npm ci

# Copy app source
COPY axemobile-main/ .

RUN npm run build

# Runtime stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config
COPY axemobile-main/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
