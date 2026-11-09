# AxeMobile doesn't share anything with other apps; AxePool's stratum port
# is published straight from docker-compose.yml.
#
# This file still has to exist: AxeMobile 1.x shipped an exports.sh that
# read $BITCOIN_RPC_USER without a default, and umbrelOS sources exports
# with `set -u`, so a stale copy of it stops the install with "unbound
# variable". Shipping this one replaces it.
export APP_AXEMOBILE_STRATUM_PORT="3334"
