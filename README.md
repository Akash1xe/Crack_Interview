# BackendTyper

A deployable machine-coding and LLD interview typing trainer built with React + TypeScript + Vite, Monaco Editor, Express + TypeScript and MongoDB.

## Run locally

1. Clone the repository.
2. Copy `.env.example` to `.env` if you want to override the default admin PIN.
3. Run `docker compose up --build`.
4. Open http://localhost:5173.
5. The API is available at http://localhost:4000/api.
6. Seed content is inserted automatically when the backend first connects to an empty database.

Default development Admin PIN: `2468`. Change `ADMIN_PIN` before using the app outside your own machine.

## Included

- Dashboard with historical metrics and quick-start navigation
- Snippet drills: practice, evaluation and recall setup/run/results
- Machine-coding library, folder preview, configurable timer, user-created virtual file paths, live diff metrics and scoring
- LLD library and C++ class-diagram/problem practice
- Admin content creation behind a server-validated PIN
- Session history with trend data
- Levenshtein-based accuracy, WPM, structure/completion/time scoring
- Seed machine-coding projects: URL Shortener, Token Bucket Rate Limiter, Cart & Order Queue Service
- Seed LLD: Parking Lot, LRU Cache, Rate Limiter Strategy, Notification Observer
