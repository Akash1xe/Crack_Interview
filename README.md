# InterviewDrill

Self-hosted machine-coding and LLD interview practice platform.

## Current implementation

Phase 0 and Phase 1 are implemented.

### Services

- API Gateway — http://localhost:4000
- Content Service — http://localhost:4001
- Session Service — http://localhost:4002
- Evaluation Service — http://localhost:4003
- Frontend — http://localhost:5173

### Infrastructure

- Content Postgres — localhost:5433
- Session Postgres — localhost:5434
- Evaluation Postgres — localhost:5435
- Redis Streams — localhost:6379

The frontend talks only to the Gateway. Each service owns its database. Cross-service reads use REST; asynchronous evaluation uses Redis Streams.

## Run locally

```bash
docker compose up --build
```

Open http://localhost:5173.

The development bearer token is `dev-token`; the SPA sends it automatically.

## Seed content

- Express Error Handler Drill
- Task API — beginner machine coding
- Authenticated Notes API — intermediate machine coding

## Async evaluation flow

1. Session Service commits a submitted session.
2. Session Service emits `session.submitted` to Redis Streams.
3. Evaluation Service consumes the event.
4. Evaluation Service fetches Session and Content data over REST.
5. Evaluation Service computes character accuracy, completion, path structure, and mistake tags.
6. Evaluation Service writes its own Report/FileResult rows.
7. Evaluation Service emits `evaluation.completed`.
8. The frontend polls the Gateway for the report.

## Reset local data

```bash
docker compose down -v
docker compose up --build
```
