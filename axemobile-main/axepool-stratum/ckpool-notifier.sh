#!/bin/bash
# ckpool notifier script - called when events happen
# This forwards events to the stats API

STATS_API="http://localhost:3334"

case "$1" in
    share)
        # Share submitted: $2=workername $3=address $4=diff $5=result
        curl -s -X POST "$STATS_API/api/pool/share" \
            -H "Content-Type: application/json" \
            -d "{\"workername\":\"$2\",\"address\":\"$3\",\"diff\":$4,\"result\":\"$5\"}"
        ;;
    block)
        # Block found: $2=height $3=hash $4=reward $5=finder
        curl -s -X POST "$STATS_API/api/pool/block" \
            -H "Content-Type: application/json" \
            -d "{\"height\":$2,\"hash\":\"$3\",\"reward\":$4,\"finder\":\"$5\"}"
        ;;
esac
