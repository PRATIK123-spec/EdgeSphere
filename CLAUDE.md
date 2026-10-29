# CLAUDE.md — EdgeSphere

Guidance for Claude Code when working in this repository. Keep this file current:
when a feature lands or a decision is made, update the relevant section.

## What this is

EdgeSphere is a full-stack IoT / edge device management platform: users registe
devices, devices push telemetry, the backend raises alerts and tracks online/offline
status, and a React dashboard shows everything in real time. It is also a portfolio
project, so code quality, security and honest data matter.

- Repo: https://github.com/PRATIK123-spec/EdgeSphere (branch `main`)
- Frontend (Vercel): https://edge-sphere.vercel.app
- Backend (Render, free plan): https://edgesphere-api.onrender.com (OpenAPI at `/docs`)
- Local dev: Windows + WSL Ubuntu, project at `/home/protik/EdgeSphere`

## Commands

Backend (from repo root, venv active):
```bash
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL and a strong SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload   # http://127.0.0.1:8000
pytest -q                       # SQLite in-memory; 4 PostgreSQL migration tests skip
EDGESPHERE_MIGRATION_TEST_PG_URL=postgresql+psycopg://user:pass@localhost:5432/postgres pytest -q
python -m simulator.device_manage
```

Frontend (`cd frontend`):
```bash
npm install
npm run dev      # http://localhost:5173, proxies /api and /api/ws to FastAPI
npm run build    # tsc -b && vite build — must pass before any frontend change is done
npm run lint     # oxlint (not ESLint)
```

## Stack (verified from dependency files)

- **Backend:** Python 3.12 (Render pins 3.12.3), FastAPI, SQLAlchemy 2, Alembic,
  Pydantic v2 + pydantic-settings, PyJWT, Uvicorn, psycopg 3. PostgreSQL in prod,
  SQLite in-memory for tests.
- **Frontend:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`),
  shadcn/Radix UI (`radix-ui`), TanStack Query 5, React Router 8 (`react-router`),
  React Hook Form + Zod 4, Recharts 3, Lucide, Sonner toasts, Geist + JetBrains Mono fonts.

## Architecture

```
Devices / simulator ──HTTP X-DEVICE-KEY──►┐
React dashboard ─────HTTP JWT───────────► │ FastAPI: Router → Service → Repository → SQLAlchemy → PostgreSQL
        ▲                                 │   + realtime hub (app/realtime/hub.py)
        └──────── WebSocket /ws ◄─────────┘   + device monitor background task (lifespan in app/main.py)
```

### Backend layout (`app/`)
- `core/` — `config.py` (all settings), `security.py` (JWT, passwords), `device_security.py` (device keys)
- `database/` — engine, session, dependencies
- `models/` — User, Device, Telemetry, Alert
- `schemas/` — Pydantic models; `common.py` holds `TOTAL_COUNT_HEADER`
- `repositories/` — user, device, telemetry, alert, analytics, dashboard
- `services/` — auth, user, device, telemetry, alert, analytics, dashboard, `device_monitor`
- `routers/` — auth, users, devices, telemetry, alert, analytics, dashboard, websocket
- `realtime/` — `hub.py` (in-process connection hub), `events.py`
- `utils/` — `device_identity.py`, `time.py`
- `main.py` — app, lifespan (binds hub to loop, starts monitor), CORS, error handlers

**Rule:** routers stay thin; business logic in services; DB access in repositories.
Every user-facing query is scoped to the caller's own devices.

### Frontend layout (`frontend/src/`)
- `pages/` — Login, Register, Dashboard, Devices, DeviceDetail, Telemetry, Analytics,
  LiveMonitor, Alerts, Profile, NotFound (lazy routes in `router.tsx`)
- `features/<area>/` — `api.ts` (calls), `hooks.ts` (TanStack Query), components.
  Areas: alerts, analytics, auth, dashboard, devices, live, realtime, system, telemetry, theme
- `components/ui/` — shadcn primitives; `components/common/` — shared app pieces
  (StatTile, StatusBadge, PageHeader, `states.tsx` for loading/empty/error);
  `components/layout/` — AppShell, Sidebar, Topbar, route guards
- `lib/api-client.ts` — **the only way to call the API**. Base is
  `VITE_API_BASE_URL ?? '/api'`; handles 401 → logout, `X-Total-Count` pages, 422 field errors,
  and never shows server text for 5xx
- `lib/auth-storage.ts` — JWT in localStorage (`edgesphere.session`), expiry from `exp`
- `lib/realtime.ts` — WebSocket client with backoff and heartbeat watchdog
- `types/api.ts` — shared API types; keep in sync with backend schemas

## API (verified against routers)

All endpoints except `/`, `/auth/register`, `/auth/login` need `Authorization: Bearer <jwt>`.
List endpoints return an array plus `X-Total-Count`. Caps: telemetry ≤ 1000, alerts ≤ 500 per page.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` (form body), `GET /users/me` |
| Devices | `GET/POST /devices/`, `GET/PUT/PATCH/DELETE /devices/{id}`, `POST /devices/{id}/rotate-key` |
| Telemetry | `POST /telemetry/` (X-DEVICE-KEY), `GET /telemetry/latest/{id}`, `GET /telemetry/{id}?limit&offset&since&until`, `GET /telemetry/{id}/series?since&until&max_points`, `DELETE /telemetry/{reading_id}` |
| Alerts | `GET /alerts/` (filters: device_id, severity, alert_type, status, since, until, limit, offset), `GET /alerts/{device_id}`, `POST /alerts/{id}/acknowledge`, `POST /alerts/{id}/resolve`, `POST /alerts/check/{device_id}`, `DELETE /alerts/{id}` → always 409 |
| Analytics | `GET /analytics/device/{id}` |
| Dashboard | `GET /dashboard/summary` |
| Realtime | `WS /ws` |

### WebSocket protocol
1. Connect, send `{"type":"auth","token":"<jwt>"}` within `WS_AUTH_TIMEOUT_SECONDS` (10 s). Token never in the URL.
2. Server replies `{"type":"ready","user_id":…,"expires_at":…}`.
3. Events (own devices only): `telemetry`, `device.status`, `alert.created`, `alert.updated`,
   `device.created`, `device.updated`, `device.deleted`. Heartbeat `{"type":"ping"}` every 30 s.
4. Close codes: `4401` bad/expired token (don't retry), `4408` auth timeout, `4400` malformed, `4008` too slow.

## Domain rules

- **Alerts:** temperature > 70 °C → CRITICAL; battery < 20 % → HIGH; CPU > 90 % → HIGH;
  RAM > 90 % → HIGH. Cooldown `ALERT_COOLDOWN_SECONDS` (300) per device + type.
  Lifecycle: active → acknowledged → resolved. Evaluation is idempotent per reading
  (DB uniqueness on `telemetry_id`). Alerts are never deleted.
- **Device status:** monitor runs every `DEVICE_MONITOR_INTERVAL_SECONDS` (15); offline afte
  `DEVICE_OFFLINE_AFTER_SECONDS` (60) without telemetry. `last_seen` is NULL until first reading.
- **Charts:** show gaps as breaks, never interpolate across outages; single reading = single point.

## Security rules (non-negotiable)

- Human auth = JWT; device auth = `X-DEVICE-KEY`. Never trust a device-supplied `device_id` as identity.
- Device keys are stored only as SHA-256 hash + short prefix. The raw key is returned **only**
  by create and rotate-key, shown once in the UI (DeviceKeyRevealDialog). Never put it in
  normal responses, logs, WebSocket events, query caches or localStorage.
- Never leak SQL, stack traces or internal messages to clients (see handlers in `main.py`).
- CORS: explicit origins only via `CORS_ORIGINS`, never `*`, `allow_credentials=False`.
- Never commit `.env` or real secrets; never print secret values; never ask for them in chat.
- No mock data in the UI. Use designed empty states instead.

## Configuration

Backend (`.env`, see `.env.example`): `DATABASE_URL`, `SECRET_KEY`, `JWT_ALGORITHM` (HS256),
`ACCESS_TOKEN_EXPIRE_MINUTES` (30), `DEBUG`, `SQL_ECHO`, `DEVICE_OFFLINE_AFTER_SECONDS`,
`DEVICE_MONITOR_INTERVAL_SECONDS`, `DEVICE_MONITOR_ENABLED`, `ALERT_COOLDOWN_SECONDS`,
`CORS_ORIGINS`, `WS_AUTH_TIMEOUT_SECONDS`, `WS_HEARTBEAT_SECONDS`.

Frontend: `VITE_API_BASE_URL` (build-time; prod = `https://edgesphere-api.onrender.com`;
changing it needs a Vercel redeploy). `EDGESPHERE_API_URL` = Vite dev-proxy target.

## Deployment

- **Render** (`render.yaml`): start command runs `alembic upgrade head` then uvicorn, **single
  process — never add `--workers`** (in-process WebSocket hub). Free plan sleeps; first request
  can take 30–60 s+ and may 502 during wake-up. Prod `CORS_ORIGINS=https://edge-sphere.vercel.app`.
- **Vercel** (`frontend/vercel.json`): SPA rewrite of all paths to `index.html`.
- `main` auto-deploys on Render. Treat any push to `main` as a production deploy.

## Database & migrations

Alembic head: `0006_alert_lifecycle` (0001 → 0006 in `alembic/versions/`). Every schema change
needs a new migration; migrations must not import ORM models. `0005_hash_device_keys` is
irreversible — back up (`pg_dump`) before running migrations on real data.

## Known issues & tech debt

- Logout is client-side only; a JWT stays valid until expiry (30 min). No refresh tokens.
- JWT lives in localStorage (XSS exposure). Moving to cookies needs CSRF/CORS redesign.
- App historically connected to Postgres as a superuser; split runtime vs migration roles.
- Early commit `7eba1ff` contained `.env` + venv files; secrets were rotated but remain in history.
- Prod: unauthorized WebSocket attempts sometimes drop without a close frame (suspected Render proxy; unconfirmed).
- `simulator/device_manager.py` still uses hardcoded placeholder keys; should read from env.
- `requirements.txt` carries redundant libs (python-jose *and* PyJWT; passlib, pwdlib, bcrypt,
  argon2; psycopg2 *and* psycopg 3; pytest in prod deps). Check imports before removing any.
- `components/common/PhasePlaceholder.tsx` appears unused.
- Historical: CRLF line endings in some backend files; 3 fast-refresh lint warnings.
- Not yet assessed: rate limiting, telemetry retention, alert dedup under concurrent ingestion.

## Roadmap (priority order)

1. **Frontend visual redesign** — consistent design system, polished dashboard/KPIs, tables,
   charts, auth pages, skeletons/empty/error states, mobile responsiveness. No backend changes, no mock data.
2. **Security hardening** — least-privilege DB role, git-history secret audit, JWT storage
   review, rate limiting, dependency audit.
3. **Observability** — structured logs with redaction, health/readiness checks, request IDs, metrics.
4. **Scalable telemetry** — batch ingest, retention/downsampling, index review with real query plans.
5. **Multi-tenancy** — organizations, membership, tenant-scoped auth, cross-tenant tests.
6. Predictive failure · 7. Anomaly detection · 8. Firmware update scheduling ·
9. Simulator/load testing (env-based keys) · 10. Realtime scaling (Redis pub/sub behind `hub.py`).

## How to work in this repo

1. Check `git status` first; never discard uncommitted work.
2. Read the relevant router → service → repository chain before changing behavior.
3. Keep changes small; explain root cause before non-trivial bug fixes.
4. After backend changes: `pytest -q`. After frontend changes: `npm run build` and `npm run lint`.
   Never claim a check passed without running it.
5. Ask before committing, pushing (push to `main` = deploy), touching production data,
   or adding dependencies.
6. Don't rewrite working code from scratch. Don't invent endpoints — check the routers.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
