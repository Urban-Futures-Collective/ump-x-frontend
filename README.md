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

The frontend will be available on port `3000` of your VPS.

## Backend integration

The frontend is fully decoupled from the backend and will communicate solely over
HTTP (OGC API Processes). The integration layer follows in a dedicated sprint once
the backend contract is settled — see `docs/frontend-backend-architecture.md` for
background.
