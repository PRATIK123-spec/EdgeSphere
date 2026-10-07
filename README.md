# EdgeSphere

IoT / edge infrastructure management platform: device provisioning, telemetry
ingestion, alerting, analytics and real-time monitoring.

- **Backend** — FastAPI · SQLAlchemy 2 · PostgreSQL · Alembic · JWT (users) ·
  hashed per-device API keys (devices). Layering: Router → Service → Repository → SQLAlchemy.
- **Frontend** — React · TypeScript · Vite · Tailwind · TanStack Query · Recharts (see `frontend/README.md`).

## Quick start

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set DATABASE_URL and a strong SECRET_KEY
alembic upgrade head          # create / migrate the schema
uvicorn app.main:app --reload # http://127.0.0.1:8000  (OpenAPI docs at /docs)

cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api and /api/ws)
```

### Upgrading an existing database

> **Back up first** (`pg_dump edgesphere > backup.sql`). Migration `0005_hash_device_keys`
> replaces plaintext device keys with SHA-256 hashes. Devices keep working with the
> key they already have, but the plaintext can never be recovered (by design), so
> the migration cannot be meaningfully downgraded.

`alembic upgrade head` from `0002_create_missing_tables` applies:

| Revision | Change |
|---|---|
| `0003_schema_hardening` | `ON DELETE CASCADE` foreign keys; indexes on `telemetry(device_id, created_at)`, `devices(last_seen)`; case-insensitive unique email |
| `0004_device_last_seen_nullable` | `devices.last_seen` is `NULL` until the first reading; repairs existing rows from real telemetry |
| `0005_hash_device_keys` | `key_hash` + `key_prefix` replace plaintext `device_key` |
| `0006_alert_lifecycle` | alert `status`/`acknowledged_at`/`resolved_at`/`telemetry_id`; idempotent evaluation; alert indexes |

## Configuration (`.env`)

See `.env.example`. Notable settings: `CORS_ORIGINS` (comma-separated explicit
origins; empty = same-origin only), `ACCESS_TOKEN_EXPIRE_MINUTES`,
`DEVICE_OFFLINE_AFTER_SECONDS`, `ALERT_COOLDOWN_SECONDS`, `SQL_ECHO` (development only).

## API overview

All endpoints except `/`, `/auth/register` and `/auth/login` require
`Authorization: Bearer <jwt>` and only ever touch the caller's own devices.
Telemetry ingest authenticates the **device** with `X-DEVICE-KEY` instead.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` (form), `GET /users/me` |
| Devices | `GET/POST /devices/`, `GET/PUT/PATCH/DELETE /devices/{id}`, `POST /devices/{id}/rotate-key` |
| Telemetry | `POST /telemetry/` (device key), `GET /telemetry/latest/{id}`, `GET /telemetry/{id}?limit&offset&since&until`, `GET /telemetry/{id}/series?since&until&max_points`, `DELETE /telemetry/{reading_id}` |
| Alerts | `GET /alerts/?device_id&severity&alert_type&status&since&until&limit&offset`, `GET /alerts/{device_id}` (same filters), `POST /alerts/{id}/acknowledge`, `POST /alerts/{id}/resolve`, `POST /alerts/check/{device_id}` |
| Analytics | `GET /analytics/device/{id}` |
| Dashboard | `GET /dashboard/summary` |

List endpoints return a JSON array and the total matching row count in the
`X-Total-Count` header. Limits are enforced server-side (telemetry ≤ 1000,
alerts ≤ 500 per page). Device keys are returned only by device creation and
key rotation — never again.

## Real-time WebSocket (`/ws`)

1. Connect, then send `{"type": "auth", "token": "<jwt>"}` within 10 s (the token never goes in the URL).
2. Server replies `{"type": "ready", "user_id": …, "expires_at": …}`.
3. Server pushes events for the user's own devices only:

```json
{ "v": 1, "type": "telemetry", "device_id": 7, "ts": "2026-10-06T12:00:00", "data": { "temperature": 41.5, "...": "..." } }
```

Event types: `telemetry`, `device.status`, `alert.created`, `alert.updated`,
`device.created`, `device.updated`, `device.deleted`. Heartbeat `{"type":"ping"}`
every 30 s. Close codes: `4401` invalid/expired token (do not retry with it),
`4408` auth timeout, `4400` malformed message, `4008` client too slow.

The connection hub is in-process: run a single API worker, or put a shared
broker (e.g. Redis pub/sub) behind `app/realtime/hub.py` before scaling out.

## Tests

```bash
pytest -q
# Include real-PostgreSQL migration tests (creates/drops throwaway databases):
EDGESPHERE_MIGRATION_TEST_PG_URL=postgresql+psycopg://user:pass@localhost:5432/postgres pytest -q
```

## Device simulator

Register devices in the UI, put their keys in `simulator/device_manager.py`
(never commit real keys), then run `python -m simulator.device_manager`.
