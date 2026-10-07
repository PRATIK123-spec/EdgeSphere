# EdgeSphere Frontend

Operations console for the EdgeSphere FastAPI backend.

React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · React Router · TanStack Query ·
React Hook Form + Zod · Recharts · Lucide · Sonner

## Running locally

Two terminals, from the repository root:

```bash
# 1. Backend (FastAPI on http://127.0.0.1:8000)
source venv/bin/activate
alembic upgrade head          # first run / after pulling migrations
uvicorn app.main:app --reload

# 2. Frontend (Vite on http://localhost:5173)
cd frontend
npm install                   # first run only
npm run dev
```

Open http://localhost:5173 and register an account.

To feed live telemetry, register a device in the backend, put its key into
`simulator/device_manager.py`, then run `python -m simulator.device_manager`.

## API access

The browser calls `/api/*`. The Vite dev server proxies those requests to FastAPI
and strips the `/api` prefix, so no CORS configuration is needed in development.

| Variable              | Default                 | Purpose                                  |
| --------------------- | ----------------------- | ---------------------------------------- |
| `EDGESPHERE_API_URL`  | `http://127.0.0.1:8000` | Proxy target for `npm run dev`/`preview` |
| `VITE_API_BASE_URL`   | `/api`                  | Base path the browser uses for API calls |

Copy `.env.example` to `.env.local` to override them.

## Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Dev server with HMR and API proxy   |
| `npm run build`   | Type-check and production build     |
| `npm run preview` | Serve the build (proxy included)    |
| `npm run lint`    | Lint with oxlint                    |

## Structure

```
src/
  components/ui/       shadcn/ui primitives (generated; edit sparingly)
  components/common/   status badges, stat tiles, empty/error/loading states
  components/layout/   app shell, sidebar, topbar, route guards
  features/<domain>/   API calls, query hooks and components per backend domain
  lib/                 API client, session storage, query client, formatting
  pages/               route components (code-split)
  types/api.ts         mirrors of the backend Pydantic schemas
```

## Authentication

- Login posts `application/x-www-form-urlencoded` credentials to `POST /auth/login`.
- The JWT is kept in `localStorage` with its decoded expiry and is never rendered.
- Every authenticated request sends `Authorization: Bearer <token>`.
- A 401 response, or reaching the token's expiry, clears the session and redirects to `/login`.
- The backend has no refresh token, so users sign in again when the token expires.

Backend timestamps are naive UTC; always parse them with `parseApiDate` from `src/lib/format.ts`.
