# AxePool Stratum Server + Stats API
# Based on ckpool solo mining setup

FROM alpine:3.19 AS builder

RUN apk add --no-cache \
    git \
    build-base \
    autoconf \
    automake \
    libtool \
    pkgconf \
    yajl-dev \
    curl-dev \
    jansson-dev

# Build ckpool (solo mining mode)
WORKDIR /build
RUN git clone https://bitbucket.org/ckolivas/ckpool.git && \
    cd ckpool && \
    ./autogen.sh && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    make install DESTDIR=/install

# Production image
FROM node:20-alpine

RUN apk add --no-cache \
    yajl \
    curl \
    jansson \
    libgcc \
    bash

# Copy ckpool binaries
COPY --from=builder /install/usr/bin/ckpool /usr/bin/ckpool
COPY --from=builder /install/usr/bin/notifier /usr/bin/notifier

# Create app directory
WORKDIR /app

# Copy stats API
COPY package.json ./
RUN npm install --production

COPY server.js ./
COPY start.sh ./
RUN chmod +x start.sh

# Create directories
RUN mkdir -p /var/log/ckpool /var/run/ckpool /data/ckpool

# Expose ports
# 3333 - Stratum
# 3334 - Stats API
EXPOSE 3333 3334

CMD ["/app/start.sh"]
