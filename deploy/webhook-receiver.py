#!/usr/bin/env python3
"""GitHub webhook receiver that triggers the Mosharan auto-deploy.

Listens on loopback only; the host Nginx virtual host for
app.mosharanco.com proxies POST /deploy/ here. Accepts GitHub push
payloads for master and runs deploy/auto-deploy.sh serialized with
flock, responding immediately so GitHub does not time out.

The deploy script is copied to a unique file before execution because
git pull rewrites it while the previous run may still be reading it.

A shared secret is optional: when /etc/mosharan-deploy-webhook.secret
exists, its first line is used to validate the X-Hub-Signature-256
header (set the same value as the GitHub webhook secret).
"""

import hashlib
import hmac
import json
import logging
import os
import shutil
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = int(os.environ.get("MOSHARAN_WEBHOOK_PORT", "8123"))
REPO_DIR = os.environ.get("MOSHARAN_REPO_DIR", "/opt/src/mosharan")
DEPLOY_SCRIPT = os.path.join(REPO_DIR, "deploy", "auto-deploy.sh")
LOCK_FILE = "/var/lock/mosharan-deploy.lock"
RUN_DIR = "/var/tmp/mosharan-deploy"
SECRET_FILE = os.environ.get(
    "MOSHARAN_WEBHOOK_SECRET_FILE", "/etc/mosharan-deploy-webhook.secret"
)
WATCHED_REF = "refs/heads/master"
MAX_BODY_BYTES = 10 * 1024 * 1024

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("mosharan-webhook")


def load_secret():
    try:
        with open(SECRET_FILE, "rb") as fh:
            secret = fh.readline().strip()
        return secret or None
    except FileNotFoundError:
        return None


def signature_valid(secret, header, body):
    if not header or not header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)


def start_deploy(commit):
    os.makedirs(RUN_DIR, exist_ok=True)
    run_copy = os.path.join(RUN_DIR, f"run-{int(time.time())}-{os.getpid()}.sh")
    shutil.copyfile(DEPLOY_SCRIPT, run_copy)
    os.chmod(run_copy, 0o700)
    env = dict(os.environ, MOSHARAN_REPO_DIR=REPO_DIR)
    subprocess.Popen(
        ["flock", "-w", "1800", LOCK_FILE, "bash", run_copy],
        cwd=REPO_DIR,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    log.info("deploy triggered for %s", commit)


class Handler(BaseHTTPRequestHandler):
    server_version = "MosharanWebhook/1.0"

    def log_message(self, fmt, *args):
        log.info("%s - %s", self.client_address[0], fmt % args)

    def reply(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/healthz":
            self.reply(200, {"status": "ok"})
        else:
            self.reply(404, {"error": "not found"})

    def do_POST(self):
        if self.path.rstrip("/") != "/deploy":
            self.reply(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.reply(400, {"error": "invalid content length"})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self.reply(400, {"error": "invalid body size"})
            return
        body = self.rfile.read(length)

        secret = load_secret()
        if secret is not None and not signature_valid(
            secret, self.headers.get("X-Hub-Signature-256"), body
        ):
            log.warning("rejected request with bad signature")
            self.reply(403, {"error": "invalid signature"})
            return

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.reply(400, {"error": "invalid JSON"})
            return

        if "zen" in payload:
            self.reply(200, {"status": "pong"})
            return

        ref = payload.get("ref", "")
        if ref != WATCHED_REF:
            self.reply(200, {"status": "ignored", "ref": ref})
            return

        head = payload.get("after", "")[:12]
        try:
            start_deploy(head)
        except Exception:
            log.exception("failed to start deploy for %s", head)
            self.reply(500, {"error": "failed to start deploy"})
            return
        self.reply(200, {"status": "deploy started", "commit": head})


if __name__ == "__main__":
    os.makedirs(RUN_DIR, exist_ok=True)
    log.info("listening on %s:%d, repo %s", HOST, PORT, REPO_DIR)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
