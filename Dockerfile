FROM python:3.12-slim-bookworm@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254 AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"
WORKDIR /app
RUN pip install --no-cache-dir uv==0.12.10
COPY src/backend/pyproject.toml src/backend/uv.lock ./
RUN uv sync --locked --no-dev --no-cache --python /usr/local/bin/python
COPY src/backend/ ./
RUN DJANGO_DEBUG=true python manage.py collectstatic --noinput \
    && groupadd --gid 10001 mosharan \
    && useradd --uid 10001 --gid 10001 --no-create-home mosharan \
    && mkdir /data && chown mosharan:mosharan /data
COPY --chmod=755 deploy/backend-entrypoint.sh /entrypoint.sh
USER 10001:10001
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4", "--timeout", "60", "--no-control-socket", "--access-logfile", "-", "--error-logfile", "-"]

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS frontend-build
WORKDIR /app
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci
COPY src/frontend/ ./
RUN npm run build

FROM nginx:stable-alpine@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c AS frontend
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist/ /usr/share/nginx/html/
COPY --from=backend /app/staticfiles/ /usr/share/nginx/static/
