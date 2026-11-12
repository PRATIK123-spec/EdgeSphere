# EdgeSphere FastAPI backend, for local development with docker-compose.yml.
# Production runs on Render's native Python runtime (render.yaml), not this image.
# No secrets are baked in: configuration comes from the environment at runtime.

FROM python:3.15-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN useradd --create-home --uid 10001 edgesphere

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY --chown=edgesphere:edgesphere alembic.ini ./
COPY --chown=edgesphere:edgesphere alembic ./alembic
COPY --chown=edgesphere:edgesphere app ./app

USER edgesphere

EXPOSE 8000

# Migrate, then serve. Single process: the WebSocket hub is in-memory, never add --workers.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
