#!/bin/bash

# AxeMobile exports.sh for Umbrel
# Automatically configures Bitcoin RPC credentials from the Umbrel node

# Get Bitcoin Node IP (defaults to bitcoin container)
export APP_BITCOIN_NODE_IP="${APP_BITCOIN_NODE_IP:-bitcoin}"

# Get RPC credentials from Umbrel's Bitcoin app
BITCOIN_DATA_DIR="${UMBREL_DATA_DIR:-/umbrel}/app-data/bitcoin/data/bitcoin"

if [[ -f "${BITCOIN_DATA_DIR}/.cookie" ]]; then
    # Read cookie-based auth from Bitcoin Core
    COOKIE=$(cat "${BITCOIN_DATA_DIR}/.cookie" 2>/dev/null)
    export APP_BITCOIN_RPC_USER="${COOKIE%%:*}"
    export APP_BITCOIN_RPC_PASS="${COOKIE#*:}"
elif [[ -n "${BITCOIN_RPC_USER}" && -n "${BITCOIN_RPC_PASS}" ]]; then
    # Use environment variables if already set
    export APP_BITCOIN_RPC_USER="${BITCOIN_RPC_USER}"
    export APP_BITCOIN_RPC_PASS="${BITCOIN_RPC_PASS}"
else
    # Fallback to Umbrel's standard Bitcoin RPC environment
    export APP_BITCOIN_RPC_USER="${APP_BITCOIN_RPC_USER:-umbrel}"
    export APP_BITCOIN_RPC_PASS="${APP_BITCOIN_RPC_PASS:-}"
fi

# Pool address (user's Bitcoin address for solo mining rewards)
export APP_POOL_ADDRESS="${APP_POOL_ADDRESS:-}"
