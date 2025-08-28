# OpenFGA Blog API

Express + Postgres + OpenFGA reference implementing blog roles and per-post permissions.

## Features
- Users with roles: admin, editor, moderator, viewer (via OpenFGA tuples)
- Posts: draft by default; publish flow; ownership transfer; per-post edit grants
- Email-only login issuing JWT
- Docker Compose with Postgres and OpenFGA (plus Playground)
- Swagger docs at /docs

## Run locally (Docker)
1. Copy env: `cp .env.example .env` and adjust if needed.
2. Start: `docker compose up --build`.
3. Open API: http://localhost:3000/docs
4. OpenFGA Playground: http://localhost:3001

## First steps
- Create an admin: call `POST /auth/login` with your email. Copy `user.id`.
- Grant yourself admin role: use OpenFGA Playground to add tuple `user:<YOUR_ID> admin user:<YOUR_ID>` or call `POST /users/{id}/roles` from another admin.
- Create other users via `/auth/login` then assign roles with `/users/{userId}/roles`.

## Authorization Model (OpenFGA)
See `src/openfga/model.json`. Key relations on `post`:
- owner: the post owner
- granted_editor: per-post granted editor (admin-granted), used by moderators
- can_edit: owner OR admin OR moderator with per-post grant
- can_delete: owner OR admin OR moderator with per-post grant (and own)
- can_publish: admin OR moderator

## Endpoints
Swagger at `src/swagger.yaml` documents request/response and auth.

## Notes
- This example keeps user roles as OpenFGA tuples under `user` type.
- Data migrations are under `sql/init.sql`.
