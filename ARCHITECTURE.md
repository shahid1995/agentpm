# AgentPM Architecture Document

**Status:** Phase 1 — Security Foundation (remediation applied)
**Version:** 1.1.0
**Last Updated:** 2026-09-20

---

## 1. System Overview

AgentPM is a visual project management platform for AI-assisted development workflows. It combines Kanban-style task management with GitHub repository integration, AI-powered planning, and codebase visualization.

### Current State (Phase 1 implemented)
- **Runtime:** Next.js 16.3.5 (App Router)
- **Styling:** Tailwind CSS + custom UI components
- **State:** Server-authoritative (auth/sessions/credentials); localStorage only for UI state (Kanban tasks)
- **Authentication:** Custom session management — PostgreSQL-backed, HttpOnly cookies, bcrypt password hashing
- **Database:** PGlite (embedded PostgreSQL) for dev/test; PostgreSQL/Neon-compatible migration for production
- **Credentials:** AES-256-GCM encrypted, stored server-side in PostgreSQL, never in browser storage
- **API security:** Zod validation, CSRF (double-submit), rate limiting, request-size limits, standard `{data, error, meta}` contract

### Historical State (Phase 0 — superseded)
- State stored entirely in browser localStorage; no authentication; no database. Superseded by Phase 1.

### Target State (future phases)
- **Database:** Neon/PostgreSQL (production)
- **State:** Server-authoritative with client cache
- **Security:** Same Phase 1 boundary, extended to all resources

---

## 2. Domain Model

### 2.1 Core Entities

```
User
├── id: UUID
├── email: string (unique)
├── passwordHash: string
├── createdAt: timestamp
└── updatedAt: timestamp

Session
├── id: UUID
├── userId: UUID (FK)
├── sessionTokenHash: string (unique) — raw token never stored
├── expiresAt: timestamp
├── createdAt: timestamp
├── lastSeenAt: timestamp?
├── revokedAt: timestamp?
└── metadata: jsonb?

Project
├── id: UUID
├── name: string
├── description: string
├── ownerId: UUID (FK → User)
├── createdAt: timestamp
└── updatedAt: timestamp

ProjectMember
├── id: UUID
├── projectId: UUID (FK)
├── userId: UUID (FK)
├── role: enum (owner, member)
└── joinedAt: timestamp

EncryptedCredential
├── id: UUID
├── userId: UUID (FK → User)
├── provider: enum (github, openai)
├── ciphertext: string (AES-256-GCM)
├── iv: string
├── authTag: string
├── keyVersion: string
├── createdAt: timestamp
├── updatedAt: timestamp
└── revokedAt: timestamp?
```

---

## 3. Persistence Architecture

### 3.1 Development / Test

**PGlite** (`@electric-sql/pglite`) — embedded PostgreSQL running in-process. Data persists to `.agentpm/pgdata/` (excluded from Git via `.gitignore`). Tables are created by `initDb()` in `src/lib/db/index.ts` using raw SQL (`CREATE TABLE IF NOT EXISTS`).

### 3.2 Production (planned)

PostgreSQL/Neon via migration files (`drizzle/0000_init.sql`). The schema is PostgreSQL-compatible. `DATABASE_URL` will select the production connection.

### 3.3 Repository Layer

`src/lib/db/repositories.ts` — Drizzle ORM functions. All queries use `and()` for compound conditions (chained `.where()` calls replace each other in Drizzle — a known pitfall fixed in this remediation).

---

## 4. Security Architecture (Phase 1)

### 4.1 Sessions

```
Browser ──HttpOnly cookie──▶ API route ──▶ AuthService.resolveSession()
                                            │
                                            ▼
                                    hashToken(token)
                                            │
                                            ▼
                            PostgreSQL sessions table (token hash lookup)
                                            │
                                    validate expiry/revocation
                                            │
                                            ▼
                                    resolve User from users table
```

- Raw session tokens are **never persisted** — only SHA-256 hashes.
- Cookie: `agentpm_session`, HttpOnly, Secure (production), SameSite=Strict.
- CSRF cookie: `agentpm_csrf` (readable by JS for double-submit pattern), validated against `x-csrf-token` header.

### 4.2 Credential Encryption

```
Browser (plaintext, one-time) ──▶ POST /api/credentials
                                        │
                              Zod validate + CSRF + auth
                                        │
                                        ▼
                            EncryptionService (AES-256-GCM)
                                        │
                                        ▼
                        PostgreSQL encrypted_credentials (ciphertext, iv, authTag, keyVersion)
                                        │
                                        ▼
                        Provider routes resolve credentials server-side
                        (GitHub/OpenAI routes decrypt only in-memory)
```

- Key from `ENCRYPTION_KEY` env var (64 hex chars = 32 bytes), never stored in database.
- Key versioning supported (`keyVersion` column).
- GET returns metadata only: `{id, provider, keyVersion, createdAt}` — never ciphertext/iv/authTag.

### 4.3 API Security Boundary

All protected routes apply:
1. Authentication (session cookie → PostgreSQL session)
2. Authorization (persisted ProjectMember role, never client-supplied)
3. Zod request validation
4. CSRF for state-changing requests (double-submit)
5. Request-size limits (1MB)
6. Rate limiting (in-memory sliding window — dev limitation; Redis planned for production)
7. Standard response contract: `{data, error: {code, message, details}, meta}`

Error codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (400), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

### 4.4 Authorization

`AuthorizationService` queries persisted `project_members`. Client-supplied roles are never trusted. Roles: `owner`, `member`.

---

## 5. API Surface

| Route | Method | Auth | CSRF | Purpose |
|-------|--------|------|------|---------|
| `/api/auth` | POST | — | — | register/login/logout (rate-limited) |
| `/api/auth` | GET | session | — | resolve current session |
| `/api/credentials` | POST | ✓ | ✓ | store encrypted credential |
| `/api/credentials` | GET | ✓ | — | list credential metadata |
| `/api/credentials` | DELETE | ✓ | ✓ | delete credential |
| `/api/chatgpt` | POST | ✓ | — | OpenAI proxy (server-side key resolution) |
| `/api/github/issues` | POST | ✓ | — | GitHub issues (server-side token) |
| `/api/github/repository-tree` | POST | ✓ | — | GitHub tree (server-side token) |

> Historical: credentials and provider tokens were previously passed from the browser in request bodies / localStorage (`agentpm-openai-key`, `agentpm-github-config`). Removed in Phase 1 remediation.

---

## 6. Test Architecture

- **Framework:** Vitest 2 (`npx vitest run`)
- **Config:** `vitest.config.ts` — `fileParallelism: false`, `singleFork` (single shared PGlite instance per run; integration tests depend on shared DB state)
- **Layers:**
  - Unit: `src/lib/**/*.test.ts` (encryption, auth, CSRF, rate limiter, schemas, API contract, cookies)
  - Integration: `src/tests/integration/*.test.ts` (persistence, auth flows, security flow)
  - **Boundary:** `api-boundary.test.ts`, `provider-boundary.test.ts` — exercise actual route handlers with `NextRequest` objects

---

## 7. Phase 1 Status

**Implemented and tested:**
- PostgreSQL-backed authentication (register/login/logout/session)
- HttpOnly session cookies; raw tokens never persisted
- AES-256-GCM credential encryption with key versioning
- Credential HTTP lifecycle (POST/GET/DELETE) with full security boundary
- Server-side credential resolution for GitHub/OpenAI routes
- Browser credential storage removed (localStorage keys eliminated)
- Persisted project-membership authorization
- CSRF, rate limiting, request-size limits on protected routes
- Standard API response contract

**Known limitations (Phase 1):**
- Rate limiting is process-local (single-instance only) — documented dev limitation
- PGlite is single-connection; production requires PostgreSQL/Neon
- Kanban tasks still use localStorage (UI state only — allowed by architecture)
- Project CRUD UI not yet built (Phase 2 scope)

**Awaiting:** independent verification audit.
