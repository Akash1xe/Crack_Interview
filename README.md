# InterviewDrill

Self-hosted machine-coding and LLD interview practice platform with an Express microservices backend and React/Tailwind SPA.

## Architecture

The frontend talks only to the API Gateway. Every stateful service owns its own Postgres database. No service queries another service's database. Cross-service reads use REST and async reactions use Redis Streams.

Services:
- Gateway — authentication, JWT verification, rate limiting, routing
- Content Service — projects, files, folder trees, LLD classes
- Session Service — session lifecycle, timer state, recall settings, reference snapshot
- Evaluation Service — Levenshtein accuracy, completion, structure scoring, mistake classification
- Progress Service — rolling WPM/accuracy, dashboard history, mistake patterns
- Admin Service — manual creation and ZIP import through Content Service REST

Async pipeline:

`session.submitted → Evaluation Service → evaluation.completed → Progress Service`

## Features implemented

- Snippet Drills
- Machine Coding Rounds
- LLD Practice in C++
- Admin manual entry
- ZIP project import
- countdown sessions
- async evaluation reports
- character-level Levenshtein accuracy
- structure and completion scoring
- rolling WPM/accuracy
- mistake pattern logging
- Focus Drill recommendations
- Recall mode with configurable 5–60 second preview
- JWT access tokens (15 minutes)
- HTTP-only refresh cookie (7 days)
- automatic frontend token refresh
- Gateway and session rate limiting
- incremental Postgres migrations
- unit tests for JWT token type handling and diff/scoring logic

## Local ports

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

## Configure

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Change at least:
- `AUTH_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ADMIN_PIN`

## Run

```bash
docker compose up --build
```

Open http://localhost:5173 and sign in with `AUTH_USERNAME` / `AUTH_PASSWORD`.

## Tests

Gateway auth tests:

```bash
cd services/gateway
npm install
npm test
```

Evaluation scoring tests:

```bash
cd services/evaluation-service
npm install
npm test
```

## Reset all local state

```bash
docker compose down -v
docker compose up --build
```

## Current status

Master build phases 0 through 4 are implemented. Runtime/container verification should still be performed on a machine with Docker and internet access for initial image/package downloads.


## Publish on Render

A production Render Blueprint is included in `render.yaml`.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/Akash1xe/Crack_Interview)

**Cost warning:** the strict microservice architecture uses private services and four independent Postgres databases. Render's free tier does not cover private services and allows only one active free Postgres database per workspace, so the Blueprint contains paid resources. Review the estimated monthly cost in Render before approving deployment.

See `DEPLOYMENT.md` for the publishing steps.
