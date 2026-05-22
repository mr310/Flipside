# FlipSide

A web app with a cassette-player UI where each session exposes 4 buttons (Play, FFW, PlayPause, Stop). Each button leads to a page with a configurable text and QR code that encodes an admin-configured URL. Clicking the QR disables all other buttons in that session (server-persisted).

## Tech stack

- **Runtime**: Bun
- **Backend**: Hono (REST API + static file serving in production)
- **Frontend**: React 18 + React Router + qrcode.react
- **Database**: SQLite via `bun:sqlite`
- **Build**: Vite

## Local development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0

### Setup

```bash
# Install dependencies
bun install

# Copy env file and edit values
cp .env.example .env
```

Edit `.env`:
```
PORT=3001
ADMIN_PASSWORD=your-secure-password
ADMIN_SECRET=your-random-secret
DB_PATH=./flipside.db
```

### Run

```bash
# Start both API server (port 3001) and Vite dev server (port 5173) in parallel
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

Admin panel: [http://localhost:5173/admin](http://localhost:5173/admin)

### Individual processes

```bash
bun run dev:server   # Hono API on :3001 (with --watch)
bun run dev:client   # Vite on :5173 (proxies /api → :3001)
```

## Production build

```bash
bun run build   # outputs to dist/client/
bun run start   # serves API + static files on PORT (default 3001)
```

## Deploy on Render

1. Push this repo to GitHub.
2. In [Render](https://render.com), create a new **Web Service** and connect the repo. Alternatively, click **Blueprint** and point it at `render.yaml` — Render will configure everything automatically.
3. The `render.yaml` already defines:
   - Build command: `bun install && bun run build`
   - Start command: `bun run start`
   - A persistent disk at `/var/data` for the SQLite file
   - Auto-generated `ADMIN_PASSWORD` and `ADMIN_SECRET` env vars

4. After the first deploy, find the generated `ADMIN_PASSWORD` in the Render dashboard under **Environment** and use it to log in at `/admin`.

## Routes

| Path | Description |
|------|-------------|
| `/` | Home — list of sessions |
| `/session/:id` | Cassette player for a session |
| `/session/:sessionId/button/:type` | QR/text page for a button |
| `/admin` | Admin login |
| `/admin/dashboard` | Session list + CRUD |
| `/admin/sessions/:id` | Edit session metadata and buttons |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `ADMIN_PASSWORD` | `admin123` | Admin login password |
| `ADMIN_SECRET` | `flipside-dev-secret` | Used to derive the auth token |
| `DB_PATH` | `./linkqr.db` | Path to the SQLite database file |
