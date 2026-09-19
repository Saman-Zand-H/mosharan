# Docker deployment

Run commands from the repository root. Docker Engine and Compose v2 or newer
are required. Python and Node run inside the build/runtime images.

## Automatic deployment on push

A GitHub webhook (JSON content type, push events) posts to
`https://app.mosharanco.com/deploy/`. The host Nginx virtual host forwards
that path to `deploy/webhook-receiver.py`, a loopback-only receiver run by
the `mosharan-deploy-webhook.service` systemd unit. Pushes to `master`
trigger `deploy/auto-deploy.sh`, which serializes through flock, takes a
consistent SQLite backup, pulls ff-only, sets `MOSHARAN_IMAGE_TAG` to the
new commit, rebuilds, waits for health, and restarts the receiver so its
own changes apply. The unit uses `KillMode=process` so that restart kills
only the listener, not the cgroup's detached deploy runs. Deploys log to
`/var/log/mosharan-deploy/` (newest 30 kept). Pushes to other branches and
GitHub ping events are ignored.

Server-side one-time installation on the VPS (`/opt/src/mosharan`):

```bash
cp deploy/mosharan-deploy-webhook.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mosharan-deploy-webhook
```

Then add to the `app.mosharanco.com` Nginx server block (443), above the
catch-all `location /`:

```nginx
location = /deploy/ {
    proxy_pass http://127.0.0.1:8123;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The server pulls over SSH with its GitHub deploy key, so `origin` must be
`git@github.com:Saman-Zand-H/mosharan.git`. The webhook currently sends no
secret; because the endpoint only rebuilds `origin/master`, abuse is limited
to wasted builds. To lock it down, write a random value to
`/etc/mosharan-deploy-webhook.secret` (first line) and set the same GitHub
webhook secret; the receiver then enforces `X-Hub-Signature-256`. CI
(`.github/workflows/ci.yml`) runs lint, type, and build checks on the same
pushes; deploys do not wait for CI results.

Manual trigger: `curl -X POST https://app.mosharanco.com/deploy/ -d '{}'`
always starts a deploy attempt (which no-ops when already current), and
`bash deploy/auto-deploy.sh` runs one directly.

## Initial setup

```bash
cp .env.example .env
chmod 600 .env
```

Set `DJANGO_SECRET_KEY` to a random secret (generate with `openssl rand -hex 32`).
Set the public host and HTTPS origin in `.env`; keep `localhost` and `127.0.0.1`
in `DJANGO_ALLOWED_HOSTS` for container health checks. Keep this file private.
When migrating an existing installation, retain its secret so sessions remain
valid, and copy its database as described below before starting the backend.

```bash
docker compose build --pull
docker compose up -d --wait
docker compose exec backend python manage.py createsuperuser
```

Compose builds `mosharan-backend:<tag>` and `mosharan-frontend:<tag>` locally from
the digest-pinned bases and locked dependencies. `MOSHARAN_IMAGE_TAG` selects the
tag (default `local`). Images include source and compiled assets; production
does not mount source or run development servers. No registry account is needed.

The backend runs as UID/GID `10001:10001`, applies migrations before Gunicorn
starts, and stores SQLite at `/data/db.sqlite3` in the `mosharan_data` volume.
One Gunicorn process with four threads keeps the existing in-memory login
throttle in a single process. The frontend serves built Vite assets, Django
admin static assets, and proxies API/admin requests to the private backend.
`/healthz` checks Django and database connectivity. Services restart unless
explicitly stopped; Docker must be enabled at boot. Logs have size limits.

## HTTPS reverse proxy

The frontend listens only on `127.0.0.1:8080` by default. Use the following
location in the host Nginx HTTPS virtual host for `app.mosharanco.com`, keeping
its existing certificate and HTTP-to-HTTPS redirect. Send **all** paths through
this location, including `/api/`, `/admin/`, and `/static/`; remove old locations
pointing to separate backend/frontend ports.

```nginx
client_max_body_size 25m;
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

Then run `nginx -t && systemctl reload nginx`. Set `MOSHARAN_HTTP_PORT` in `.env`
if 8080 is occupied. The host proxy must overwrite `X-Forwarded-Proto`: Django
trusts it and enables secure cookies and HTTPS redirects. Do not expose either
container port directly to the public network. TLS certificates and their
renewal remain managed by the host; InvenTree's virtual host is independent.

## Migrating the original systemd installation

Build first while the old services are running. Back up the host Nginx config
and `/etc/mosharan.env` to a root-only directory. Copy its Django secret, allowed
hosts and trusted origins into `.env`. Stop the old backend before taking the
final SQLite backup, preventing writes during the switch:

```bash
systemctl stop mosharan-backend
python3 - <<'PY'
import os
import sqlite3

os.umask(0o077)
with sqlite3.connect('src/backend/db.sqlite3') as source:
    with sqlite3.connect('/root/mosharan-pre-compose.sqlite3') as backup:
        source.backup(backup)
        assert backup.execute('PRAGMA integrity_check').fetchone() == ('ok',)
PY
docker compose create backend
docker compose cp /root/mosharan-pre-compose.sqlite3 backend:/data/db.sqlite3
docker compose run --rm --no-deps --user 0 backend \
    chown 10001:10001 /data /data/db.sqlite3
docker compose up -d --wait
```

Never overwrite a volume containing newer data. Verify table counts, login,
dashboard/API access, and admin CSS through HTTPS before disabling the old
`mosharan-backend` and `mosharan-frontend` units. Keep the original database and
backup as recovery copies. Demo seeding is optional and never runs at startup.

## Updates and rollback

Before upgrading, take a consistent SQLite backup with its backup API (or stop
the backend before copying), and retain the prior image tag and `.env`.

```bash
git pull --ff-only origin master
# Set MOSHARAN_IMAGE_TAG in .env to the new git commit for a retained release tag.
docker compose build --pull
docker compose up -d --wait
docker compose ps
docker compose logs --tail=50
curl -fsS https://app.mosharanco.com/healthz
```

To roll back a code-only update, select the previous `MOSHARAN_IMAGE_TAG` and
run `docker compose up -d --no-build --wait`. Schema changes need a separate
migration rollback or database restore plan; don't restore an old snapshot
over new user writes. During the initial migration, before allowing writes on
Compose, the original systemd services and saved Nginx config provide rollback.

Use `docker compose down` to remove containers without deleting the database.
`docker compose down -v` deletes the database volume. Keep backups outside it.
