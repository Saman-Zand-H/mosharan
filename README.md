# Device Events API

Minimal Django and Django Ninja backend for receiving microcontroller events.
The current endpoint accepts any JSON object and returns the same object.

## Run locally

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
```

## Development checks

```bash
uv run ruff check .
uv run ruff format --check .
uv run pyrefly check --min-severity warn
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
```

## Language and accounts

Persian (`fa`) is the default language. Requests can select English with the
`Accept-Language: en` header.

The custom `account.User` model uses `username` as its login identifier and
inherits Django's `AbstractBaseUser` and `PermissionsMixin`. Email is required,
unique, and normalized by Django's user manager. No login or account API
endpoints exist yet.

Set `DJANGO_SECRET_KEY` before running outside local development.

## Echo an event

```bash
curl --request POST http://127.0.0.1:8000/api/events/echo \
  --header 'Content-Type: application/json' \
  --data '{"type":"temperature","device_id":"sensor-01","value":24.5}'
```

Response:

```json
{"type": "temperature", "device_id": "sensor-01", "value": 24.5}
```

Interactive API documentation: <http://127.0.0.1:8000/api/docs>

This prototype endpoint has no authentication. Do not expose it publicly before
adding device authentication, request limits, and a production secret key.
