# Career Hunt — production roadmap

This document maps the **master production prompt** to what exists in the repo and what remains.

## Implemented in this iteration (Phase 1 starter)

| Area | Status |
|------|--------|
| PostgreSQL schema | `backend/prisma/schema.prisma` — Users, Students, Skills, Projects, Internships, Applications, Assessments (+ questions, results), CVHistory, AuditLog, RefreshToken |
| Migrations | Prisma Migrate (`npm run prisma:migrate` in `backend/`) |
| Docker Postgres | `docker-compose.yml` at repo root |
| Auth | bcrypt (12 rounds), JWT access + refresh (hashed in DB), `/api/v1/auth/register`, `/login`, `/refresh-token`, `/logout`, `/me` |
| Security baseline | Helmet, CORS (configurable origin), JSON body limit, rate limits (auth: 5/min, API: 100/min) |
| Audit trail | `writeAuditLog` on register, login, refresh, logout |
| Seed data | `backend/prisma/seed.ts` — aligns with demo emails (`ahmed@gmail.com`, `sara@gmail.com`, `recruiter@gmail.com`, password `shoaib`) |

## Legacy prototype (unchanged)

| Area | Location |
|------|----------|
| JSON file API + Gemini proxy | `server/index.mjs`, `server/store.mjs` |
| React app | Vite root; still calls `/api/*` on port **4000** by default |

## Next integration steps (recommended order)

1. **Point the frontend** at the new API (`VITE_API_URL=http://localhost:5050`) and replace auth calls with `/api/v1/auth/*` + Bearer tokens.
2. **Port bootstrap** — replace `/api/bootstrap` with Prisma-backed aggregates (or GraphQL).
3. **Implement remaining REST** from the master spec (students, projects, internships, applications, files).
4. **AI services** — move Gemini logic from `server/gemini.mjs` into `backend/src/services/ai/*` with queues (Bull/Redis) for long jobs.
5. **S3 / ClamAV / Redis** — file uploads, caching, rate limit store.
6. **Tests & CI** — Jest, supertest, Playwright per master checklist.

## Realistic timeline

The full master prompt is **multi-month** engineering. The `backend/` package is the intended foundation; keep `server/` only until routes are fully migrated, then remove it.
