# InterviewDrill

Phase 0 microservices skeleton for the InterviewDrill platform.

## Services

- API Gateway: http://localhost:4000
- Content Service: http://localhost:4001
- Session Service: http://localhost:4002
- Frontend: http://localhost:5173
- Content Postgres: localhost:5433
- Session Postgres: localhost:5434

The frontend only talks to the Gateway. The Session Service talks to the Content Service over REST and never reads the Content database.

## Run

```bash
docker compose up --build
```

Then open http://localhost:5173.

Phase 0 uses the development bearer token `dev-token`. The frontend sends it automatically.

## Reset seed data

```bash
docker compose down -v
docker compose up --build
```
