#!/bin/bash
set -e

echo "=== AxePool Stratum Server ==="

# Create ckpool config
mkdir -p /etc/ckpool
cat > /etc/ckpool/ckpool.conf << EOF
{
    "btcd" : [
        {
            "url" : "${BITCOIN_RPC_HOST:-umbrel.local}:${BITCOIN_RPC_PORT:-8332}",
            "auth" : "${BITCOIN_RPC_USER:-umbrel}",
            "pass" : "${BITCOIN_RPC_PASS:-}"
        }
    ],
    "btcaddress" : "${POOL_ADDRESS:-}",
    "btcsig" : "Mined by AxePool",
    "blockpoll" : 100,
    "nonce1length" : 4,
    "nonce2length" : 8,
    "update_interval" : 30,
    "mindiff" : 1,
    "startdiff" : 1,
    "maxdiff" : 0,
    "logdir" : "/var/log/ckpool",
    "rundir" : "/var/run/ckpool"
}
EOF

# Start stats API in background
echo "Starting Stats API on port 3334..."
node /app/server.js &
STATS_PID=$!

# Wait for Bitcoin node if address is set
if [ -n "$POOL_ADDRESS" ]; then
    echo "Pool address: $POOL_ADDRESS"
    echo "Starting ckpool stratum server on port 3333..."
    
    # Start ckpool in solo mode
    exec /usr/bin/ckpool -c /etc/ckpool/ckpool.conf -s -k -n
else
    echo "⚠️  POOL_ADDRESS not set - running stats API only"
    echo "Set POOL_ADDRESS environment variable to enable stratum"
    
    # Keep stats API running
    wait $STATS_PID
fi
