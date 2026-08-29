# InterviewDrill

Self-hosted machine-coding and LLD interview practice platform using an Express microservices backend and a separate React/Tailwind SPA.

## Implemented phases

### Phase 0
- API Gateway
- Content Service
- Session Service
- isolated Content and Session Postgres databases
- seeded snippet drill
- end-to-end start/type/submit flow

### Phase 1
- Redis Streams
- Evaluation Service + isolated Evaluation Postgres
- `session.submitted` → async evaluation → `evaluation.completed`
- Levenshtein character accuracy
- completion and path-structure scoring
- mistake tags
- beginner/intermediate machine-coding projects
- async report polling through Gateway

### Phase 2
- `LldClass` migration and CRUD API
- generic class/file session units
- Parking Lot, LRU Cache, Rate Limiter, Elevator System seeds
- C++ class-by-class typing
- pre-session problem statement + class-plan view
- pattern tags and pattern-aware evaluation summary

## Service ports

- Gateway: http://localhost:4000
- Content Service: http://localhost:4001
- Session Service: http://localhost:4002
- Evaluation Service: http://localhost:4003
- Frontend: http://localhost:5173

## Infrastructure

- Content Postgres: localhost:5433
- Session Postgres: localhost:5434
- Evaluation Postgres: localhost:5435
- Redis: localhost:6379

The architectural boundary is strict: no service queries another service's database. Cross-service reads use REST and async reactions use Redis Streams.

## Run

```bash
docker compose up --build
```

Open http://localhost:5173.

The development Gateway token is `dev-token`, sent automatically by the SPA.

## Reset all local data

```bash
docker compose down -v
docker compose up --build
```
