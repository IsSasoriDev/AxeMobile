# syntax=docker/dockerfile:1.7
# AxeMobile for Umbrel: the React web UI and the Rust engine (miner poller,
# SQLite history, /api) in one small image. Build context is the repo root.

FROM node:20-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM rust:1-alpine AS server
RUN apk add --no-cache build-base
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --release --locked -p axe-server \
 && strip target/release/axemobile-server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata su-exec \
 && adduser -D -u 1000 axemobile \
 && mkdir -p /data && chown 1000:1000 /data
COPY --from=server /src/target/release/axemobile-server /usr/local/bin/axemobile-server
COPY --from=web /app/dist /app/dist
COPY axemobile-main/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh
ENV AXEMOBILE_DATA=/data \
    AXEMOBILE_WEB=/app/dist \
    AXEMOBILE_PORT=3847 \
    RUST_LOG=info
# starts as root so entrypoint.sh can fix /data ownership, then runs the
# server as 1000:1000
EXPOSE 3847
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3847/api/health >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
