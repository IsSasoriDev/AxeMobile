#!/bin/sh
# Make sure /data belongs to the app user before starting.
#
# umbrelOS creates the committed data/ folder owned by 1000:1000, but
# installs from before that (or a plain `docker run -v`) can hand us a
# root-owned folder, and then the server can't create its database.
set -e

DATA="${AXEMOBILE_DATA:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA"
  chown -R 1000:1000 "$DATA" 2>/dev/null || echo "axemobile: could not chown $DATA, continuing" >&2
  exec su-exec 1000:1000 axemobile-server "$@"
fi

exec axemobile-server "$@"
