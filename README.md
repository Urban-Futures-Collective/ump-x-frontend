# UMP-X Frontend

Web frontend for the **Urban Model Platform (UMP)** of the City Science Lab Hamburg.
Makes urban simulation models (OGC API Processes) accessible through a web interface.

Stack: Nuxt 4 · Nuxt UI v4 (Tailwind v4) · i18n (DE/EN) · TypeScript.

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Deploy on VPS with Docker

Build and run with Docker Compose:

```bash
docker compose up -d --build
```

By default, the compose file binds the frontend to `127.0.0.1:3000` for use behind
a reverse proxy on the VPS.
The compose file uses `restart: unless-stopped` for production-style uptime; change
that policy if you need different restart behavior.
If you need direct public access instead, change the port mapping and ensure firewall
rules are configured accordingly.

## Backend integration

The frontend is fully decoupled from the backend and will communicate solely over
HTTP (OGC API Processes). The integration layer follows in a dedicated sprint once
the backend contract is settled — see `docs/frontend-backend-architecture-de.md` for
background.
