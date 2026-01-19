FROM alpine:3.19

# Install dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    git \
    build-base \
    autoconf \
    automake \
    libtool \
    curl \
    bash

# Build ckpool from source
WORKDIR /tmp
RUN git clone https://bitbucket.org/ckolivas/ckpool.git && \
    cd ckpool && \
    ./autogen.sh && \
    ./configure --without-ckdb && \
    make && \
    make install && \
    cd / && rm -rf /tmp/ckpool

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
