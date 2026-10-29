# EdgeSphere

**Full-stack IoT / edge device management platform: register devices, ingest telemetry, raise alerts, and monitor a fleet in real time.**

<!-- Screenshot: add docs/dashboard.png and uncomment
![EdgeSphere dashboard](docs/dashboard.png)
-->

## Features

- **Device management**: register, edit, and delete devices; each device gets a one-time API key (stored as a SHA-256 hash) that can be rotated
- **Telemetry ingestion**: devices push temperature, battery, CPU, and RAM readings authenticated by `X-DEVICE-KEY`
- **Alerting engine**: rule-based alerts (temperature > 70 °C, battery < 20 %, CPU/RAM > 90 %) with cooldown, severity, and an acknowledge → resolve lifecycle
- **Real-time updates**: authenticated WebSocket pushes telemetry, device status, and alert events to the dashboard
- **Offline detection**: a background monitor marks devices offline when they stop reporting
- **Analytics & dashboard**: fleet summary, per-device insights, and down-sampled time series for charts
- **Multi-tenant security**: JWT user auth; every query is scoped to the caller's own devices; no SQL or stack traces leak to clients
- **Device simulator**: spins up multiple virtual devices that stream realistic sensor data

## Architecture

```
 Devices / simulator ──HTTP (X-DEVICE-KEY)──►┐
                                             │   FastAPI backend
 React dashboard ──HTTP (JWT)──────────────► │   Router → Service → Repository → SQLAlchemy ──► PostgreSQL
        ▲                                    │        │
        └────────── WebSocket /ws ◄──────────┘   realtime hub (events) + device monitor (background task)
```

## Tech Stack

| Layer | Technologies |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, PyJWT, Uvicorn |
| Database | PostgreSQL (SQLite in-memory for tests) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, React Hook Form + Zod, shadcn/Radix UI |
| Testing | pytest, FastAPI TestClient |
| Deployment | Render (backend + Postgres via `render.yaml`), Vercel (frontend) |

## Project Structure

```
EdgeSphere/
├── app/
│   ├── core/           # settings, JWT and device-key security
│   ├── database/       # engine, session, dependencies
│   ├── models/         # SQLAlchemy models: User, Device, Telemetry, Alert
│   ├── schemas/        # Pydantic request/response models
│   ├── repositories/   # data access layer
│   ├── services/       # business logic (alerts, analytics, device monitor, ...)
│   ├── routers/        # REST + WebSocket endpoints
│   ├── realtime/       # in-process WebSocket event hub
│   └── main.py         # app factory, lifespan, error handlers
├── alembic/            # database migrations
├── frontend/           # React + TypeScript dashboard (see frontend/README.md)
├── simulator/          # virtual devices that stream telemetry
├── tests/              # pytest suite
├── render.yaml         # Render blueprint
└── requirements.txt
```

## Setup & Installation

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

## Testing

```bash
pytest -q
# Include real-PostgreSQL migration tests (creates/drops throwaway databases):
EDGESPHERE_MIGRATION_TEST_PG_URL=postgresql+psycopg://user:pass@localhost:5432/postgres pytest -q
```

## Device simulator

```bash
# One virtual device per key; keys come from Register device / Rotate key in the UI.
EDGESPHERE_DEVICE_KEYS="edg_…,edg_…" python -m simulator.device_manager
```

| Variable | Default | Meaning |
|---|---|---|
| `EDGESPHERE_SERVER` | `http://127.0.0.1:8000` | API base URL |
| `EDGESPHERE_DEVICE_KEYS` | (required) | Comma-separated device keys |
| `EDGESPHERE_INTERVAL` | `5` | Seconds between readings per device |
| `EDGESPHERE_START_TEMP` | normal 28–34 °C | Starting temperature; e.g. `75` to trigger temperature alerts |

Keys are secrets: the simulator never prints them. Device numbers in its output are local
labels, not server device IDs.

## Results

- **89 tests passing** (4 PostgreSQL-only migration tests skip without a database), covering auth, device keys, device management, telemetry pagination and series, the alert lifecycle, analytics, the dashboard, the offline monitor, the WebSocket protocol, and the simulator's configuration.

## Future Work

- Replace the in-process WebSocket hub with a shared broker (e.g. Redis pub/sub) so the API can run multiple workers
- Make alert thresholds configurable per device

## License

Released under the [MIT License](LICENSE).
