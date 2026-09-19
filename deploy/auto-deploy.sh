#!/bin/bash
# Mosharan auto-deploy: run by deploy/webhook-receiver.py after a push to
# master, or manually. Serialized through flock by the caller; safe to run
# repeatedly. Follows the documented update procedure in deploy/README.md:
# consistent SQLite backup, ff-only pull, rebuild, wait for health.
set -euo pipefail

REPO_DIR="${MOSHARAN_REPO_DIR:-/opt/src/mosharan}"
SITE_URL="${MOSHARAN_SITE_URL:-https://app.mosharanco.com}"
BACKUP_DIR="/root/mosharan-compose-backups"
LOG_DIR="/var/log/mosharan-deploy"
LOG_FILE="$LOG_DIR/deploy-$(date -u +%Y%m%dT%H%M%SZ)-$$.log"

mkdir -p "$LOG_DIR" "$BACKUP_DIR"
exec >>"$LOG_FILE" 2>&1

# The receiver runs a unique copy from /var/tmp so git pull can rewrite the
# tracked file mid-run; only those copies clean themselves up.
case "$0" in
    /var/tmp/mosharan-deploy/*) trap 'rm -f "$0"' EXIT ;;
esac

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

cd "$REPO_DIR"
git fetch origin master
BEFORE=$(git rev-parse HEAD)
AFTER=$(git rev-parse origin/master)
if [ "$BEFORE" = "$AFTER" ]; then
    log "already at $BEFORE; nothing to do"
    exit 0
fi
log "deploying $BEFORE -> $AFTER"

TAG_AFTER=$(git rev-parse --short=12 origin/master)
if [ -n "$(docker compose ps -q --status running backend)" ]; then
    docker compose exec -T backend python - <<'PY'
import sqlite3

with sqlite3.connect("/data/db.sqlite3") as source:
    with sqlite3.connect("/data/backup.sqlite3") as backup:
        source.backup(backup)
        assert backup.execute("PRAGMA integrity_check").fetchone() == ("ok",)
PY
    docker compose cp backend:/data/backup.sqlite3 \
        "$BACKUP_DIR/pre-$TAG_AFTER-$(date -u +%Y%m%dT%H%M%SZ).sqlite3"
    docker compose exec -T backend rm /data/backup.sqlite3
    log "database backed up to $BACKUP_DIR"
fi

git pull --ff-only origin master
TAG=$(git rev-parse --short=12 HEAD)
sed -i "s/^MOSHARAN_IMAGE_TAG=.*/MOSHARAN_IMAGE_TAG=$TAG/" .env
log "image tag set to $TAG"

docker compose build --pull
docker compose up -d --wait
log "containers recreated and healthy"

# Apply receiver changes shipped by this deploy; the detached deploy keeps
# running when its parent listener restarts.
if systemctl is-active --quiet mosharan-deploy-webhook.service; then
    systemctl restart mosharan-deploy-webhook.service \
        && log "webhook receiver restarted" \
        || log "WARNING: webhook receiver restart failed"
fi

curl -fsS "$SITE_URL/healthz" >/dev/null && log "healthz OK"

log "deploy finished: $BEFORE -> $AFTER (tag $TAG, log $LOG_FILE)"

# Keep the newest 30 deploy logs.
ls -1t "$LOG_DIR"/deploy-*.log 2>/dev/null | tail -n +31 | xargs -r rm -f
