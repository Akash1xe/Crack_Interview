# InterviewDrill

Self-hosted machine-coding and LLD interview practice platform with an Express microservices backend and React/Tailwind SPA.

## Implemented through Phase 3

### Core services
- Gateway — auth stub, rate limiting, routing only
- Content Service — projects, files, folder nodes, LLD classes
- Session Service — session lifecycle and content snapshot
- Evaluation Service — Levenshtein accuracy, completion, structure, mistake tags
- Progress Service — rolling stats, WPM, historical events, mistake patterns
- Admin Service — manual content creation and ZIP project import

### Async pipeline
`session.submitted` → Evaluation Service → `evaluation.completed` → Progress Service

Redis Streams is used for async reactions. No service directly reads another service's database.

### Local ports
- Gateway: 4000
- Content: 4001
- Session: 4002
- Evaluation: 4003
- Progress: 4004
- Admin: 4005
- Frontend: 5173
- Content Postgres: 5433
- Session Postgres: 5434
- Evaluation Postgres: 5435
- Progress Postgres: 5436
- Redis: 6379

## Phase 3 UI
- progress dashboard
- per-category average accuracy / WPM / session count
- recent accuracy trend
- mistake-pattern log
- focus-content shortlist
- Admin PIN gate
- manual project/snippet/LLD creation
- ZIP upload with path preservation and simple auto-tagging

## Run

```bash
docker compose up --build
```

Open http://localhost:5173.

Development auth token: `dev-token`.
Default local Admin PIN: `2468` (override with `ADMIN_PIN`).

## Reset local state

```bash
docker compose down -v
docker compose up --build
```
