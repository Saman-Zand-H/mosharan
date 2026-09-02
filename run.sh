#!/usr/bin/env bash

set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="${project_dir}/src/backend"
frontend_dir="${project_dir}/src/frontend"

backend_host="${BACKEND_HOST:-127.0.0.1}"
backend_port="${BACKEND_PORT:-8000}"
frontend_host="${FRONTEND_HOST:-127.0.0.1}"
frontend_port="${FRONTEND_PORT:-5173}"

backend_pid=""
frontend_pid=""

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$1" >&2
        exit 1
    fi
}

stop_services() {
    local pid

    for pid in "$frontend_pid" "$backend_pid"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    for pid in "$frontend_pid" "$backend_pid"; do
        if [[ -n "$pid" ]]; then
            wait "$pid" 2>/dev/null || true
        fi
    done
}

handle_exit() {
    local status=$?

    trap - EXIT INT TERM
    stop_services
    exit "$status"
}

handle_signal() {
    trap - EXIT INT TERM
    stop_services
    exit 130
}

trap handle_exit EXIT
trap handle_signal INT TERM

require_command uv
require_command npm

if [[ ! -d "${frontend_dir}/node_modules" ]]; then
    printf 'Installing frontend dependencies...\n'
    npm --prefix "$frontend_dir" ci
fi

printf 'Applying database migrations...\n'
uv run --directory "$backend_dir" python manage.py migrate --noinput

export VITE_BACKEND_PROXY_TARGET="${VITE_BACKEND_PROXY_TARGET:-http://${backend_host}:${backend_port}}"

uv run --directory "$backend_dir" \
    python manage.py runserver "${backend_host}:${backend_port}" &
backend_pid=$!

(
    cd "$frontend_dir"
    exec ./node_modules/.bin/vite \
        --host "$frontend_host" \
        --port "$frontend_port" \
        --strictPort
) &
frontend_pid=$!

printf '\nBackend: http://%s:%s\n' "$backend_host" "$backend_port"
printf 'Frontend: http://%s:%s\n' "$frontend_host" "$frontend_port"
printf 'Press Ctrl+C to stop both services.\n\n'

wait -n "$backend_pid" "$frontend_pid"
