# AxeMobile doesn't share anything with other apps, but this file still has
# to exist: AxeMobile 1.x shipped an exports.sh that read $BITCOIN_RPC_USER
# without a default, and umbrelOS sources exports with `set -u`, so a stale
# copy of it stops the install with "unbound variable". Shipping this one
# replaces it.
export APP_AXEMOBILE_UI_PORT="3847"
