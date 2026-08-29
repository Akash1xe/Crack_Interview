# Publish InterviewDrill on Render

InterviewDrill includes a Render Blueprint at `render.yaml`.

## Important cost note

The architecture keeps Content, Session, Evaluation, Progress, and Admin as private services and gives each stateful service its own Postgres database. Render does not offer free private services, and a workspace can have only one active free Postgres database. The Blueprint therefore uses paid Starter private services and paid Basic Postgres instances while keeping the public Gateway, static frontend, and Key Value instance on free plans where supported.

Review Render's estimated monthly cost before approving the Blueprint.

## Publish

1. Open the repository's **Deploy to Render** link from the README.
2. Sign in to Render and connect GitHub if prompted.
3. Review all resources and their prices.
4. Enter values for `AUTH_PASSWORD` and `ADMIN_PIN`.
5. Render generates the JWT secrets automatically.
6. Approve **Deploy Blueprint**.
7. Wait for all services to become healthy.
8. Open the URL for `interviewdrill-frontend`.
9. Sign in with username `akash` and the password you supplied.

The frontend talks only to the public Gateway. Content, Session, Evaluation, Progress, and Admin are private Render services.
