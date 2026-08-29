# InterviewDrill — Next.js Vercel Edition

InterviewDrill is a full-stack machine-coding and LLD interview practice platform rebuilt as a **single Next.js application** so it can be deployed on Vercel without running six separate backend services.

## Stack

- Next.js App Router
- React
- Tailwind CSS
- Monaco Editor
- Neon serverless Postgres
- JWT-style signed HTTP-only session cookie with `jose`
- Recharts for progress trends

There is **no Redis, Docker, message queue, private service, or separate backend deployment** in this edition. Evaluation and progress updates happen synchronously inside Next.js route handlers.

## Features

- Snippet Drills
- Machine Coding Rounds
- LLD Practice
- Admin / Content Management
- real-time Monaco diffing
- live WPM and character accuracy
- countdown timer
- automatic timeout submission
- machine-coding path / structure scoring
- completion scoring
- Levenshtein-based evaluation
- mistake-pattern classification
- progress dashboard
- Focus Drill suggestions
- Recall mode with configurable preview
- C++ LLD problems and pattern tags
- ZIP project import
- durable sessions/results in Postgres
- single-user login
- Admin PIN protection

## Seed content

### Snippets
- Express Error Handler
- Mongo Update Query
- Async Controller

### Machine Coding
- URL Shortener API
- Rate Limiter Service
- Cart & Order Service

### LLD
- Parking Lot System
- LRU Cache
- Rate Limiter
- Elevator System

## Local setup

Install Node.js 20+.

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set a Neon Postgres connection string in `DATABASE_URL`, then:

```bash
npm run dev
```

Open http://localhost:3000.

The database schema and seed content are created automatically on the first database-backed request.

## Deploy for free

The app itself can be deployed on the **Vercel Hobby plan**. Persistence uses a **free Neon Postgres** database.

### 1. Create free Neon database

Create a Neon project and copy its pooled/serverless Postgres connection string.

### 2. Import this repository into Vercel

Repository:

`Akash1xe/Crack_Interview`

Framework preset should be detected automatically as Next.js.

### 3. Add Vercel environment variables

```text
DATABASE_URL=<your Neon connection string>
AUTH_USERNAME=akash
AUTH_PASSWORD=<your login password>
SESSION_SECRET=<long random secret>
ADMIN_PIN=<your admin pin>
```

Add them for Production, Preview, and Development if you want the same configuration everywhere.

### 4. Deploy

Click **Deploy**. No Docker, Redis, or additional Vercel services are required.

On the first visit after deployment, the first API request creates the tables and seed content in Neon automatically.

## Tests

```bash
npm test
npm run build
```

## Important deployment note

Vercel Hobby and Neon free plans have usage limits. For a personal interview-practice application, this architecture is intentionally designed to fit those free tiers much better than the previous microservice version.
