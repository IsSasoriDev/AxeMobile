FROM alpine:3.19

# Install dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    git \
    ca-certificates \
    build-base \
    autoconf \
    automake \
    libtool \
    curl \
    bash

# Build ckpool from source (using GitHub mirror as bitbucket can be unreliable)
WORKDIR /tmp
RUN set -eux; \
    update-ca-certificates; \
    rm -rf /tmp/ckpool /tmp/ckpool.tar.gz; \
    \
    # Prefer downloading a tarball (avoids flaky git transport in CI), with retries.
    if curl -fsSL \
        --retry 5 \
        --retry-all-errors \
        --connect-timeout 20 \
        -o /tmp/ckpool.tar.gz \
        https://codeload.github.com/ckolivas/ckpool/tar.gz/refs/heads/master; then \
      mkdir -p /tmp/ckpool; \
      tar -xzf /tmp/ckpool.tar.gz --strip-components=1 -C /tmp/ckpool; \
    else \
      echo "Tarball download failed; falling back to git clone..." >&2; \
      for i in 1 2 3; do \
        rm -rf /tmp/ckpool; \
        if git -c http.version=HTTP/1.1 clone --depth 1 https://github.com/ckolivas/ckpool.git /tmp/ckpool; then \
          break; \
        fi; \
        echo "git clone failed (attempt ${i}/3), retrying..." >&2; \
        sleep 5; \
      done; \
      test -d /tmp/ckpool; \
    fi; \
    \
    cd /tmp/ckpool; \
    ./autogen.sh; \
    ./configure --without-ckdb; \
    make; \
    make install; \
    cd /; \
    rm -rf /tmp/ckpool /tmp/ckpool.tar.gz

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application files
COPY server.js ./
COPY start.sh ./
COPY ckpool-notifier.sh ./

# Make scripts executable
RUN chmod +x start.sh ckpool-notifier.sh

# Create data directory
RUN mkdir -p /data/ckpool

# Expose ports (stratum: 3333, stats API: 3334)
EXPOSE 3333 3334

# Start the services
CMD ["./start.sh"]
