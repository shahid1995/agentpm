# AgentPM Architecture Document

**Status:** Phase 0 — Architecture Lock
**Version:** 1.0.0
**Last Updated:** 2026-09-20

---

## 1. System Overview

AgentPM is a visual project management platform for AI-assisted development workflows. It combines Kanban-style task management with GitHub repository integration, AI-powered planning, and codebase visualization.

### Current State
- **Runtime:** Next.js 16.3.5 (App Router)
- **Styling:** Tailwind CSS + custom UI components
- **State:** Browser localStorage (temporary)
- **Authentication:** None
- **Database:** None (stateless)

### Target State
- **Runtime:** Next.js 16.x (App Router)
- **Database:** Neon/PostgreSQL
- **Authentication:** Custom session management
- **State:** Server-authoritative with client cache
- **Security:** Encrypted credentials, CSRF protection, rate limiting

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
├── token: string (hashed)
├── expiresAt: timestamp
├── createdAt: timestamp
└── revokedAt: timestamp?

Project
├── id: UUID
├── name: string
├── description: string
├── ownerId: UUID (FK → User)
├── createdAt: timestamp
└── updatedAt: timestamp

ProjectMember
├── projectId: UUID (FK)
├── userId: UUID (FK)
├── role: enum (owner, editor, viewer)
└── joinedAt: timestamp

Repository
├── id: UUID
├── projectId: UUID (FK → Project)
├── provider: string (default: 'github')
├── owner: string
├── name: string
├── defaultBranch: string
├── credentialId: UUID (FK → EncryptedCredential)
├── createdAt: timestamp
└── updatedAt: timestamp

WorkItem
├── id: UUID
├── projectId: UUID (FK → Project)
├── repositoryId: UUID? (FK → Repository)
├── githubIssueId: string? (external ref)
├── title: string
├── description: string
├── status: enum (idea, planning, ready, executing, verification, done)
├── priority: enum (low, medium, high)?
├── createdAt: timestamp
└── updatedAt: timestamp

ContextBoundary
├── id: UUID
├── workItemId: UUID (FK → WorkItem)
├── repositoryId: UUID (FK → Repository)
├── branch: string?
├── paths: string[]
├── files: string[]
├── exclusions: string[]
└── createdAt: timestamp

Specification
├── id: UUID
├── workItemId: UUID (FK → WorkItem)
├── version: integer
├── content: string
├── status: enum (draft, review, approved, superseded)
├── createdAt: timestamp
└── updatedAt: timestamp

AgentPrompt
├── id: UUID
├── workItemId: UUID (FK → WorkItem)
├── version: integer
├── content: string
├── generatedBy: enum (user, ai)
├── approvedAt: timestamp?
├── createdAt: timestamp
└── updatedAt: timestamp

Execution
├── id: UUID
├── workItemId: UUID (FK → WorkItem)
├── agentType: string?
├── status: enum (pending, running, succeeded, failed, cancelled)
├── startedAt: timestamp?
├── completedAt: timestamp?
├── result: jsonb?
└── createdAt: timestamp

Verification
├── id: UUID
├── executionId: UUID (FK → Execution)
├── status: enum (not_started, running, passed, failed, blocked)
├── verifier: string
├── startedAt: timestamp?
├── completedAt: timestamp?
├── summary: string?
└── createdAt: timestamp

Evidence
├── id: UUID
├── verificationId: UUID (FK → Verification)
├── type: enum (test_result, build_result, lint_result, screenshot, commit, pull_request, review, log, manual)
├── description: string
├── reference: string
└── createdAt: timestamp

EncryptedCredential
├── id: UUID
├── userId: UUID (FK → User)
├── provider: enum (github, openai)
├── encryptedValue: bytea
├── iv: bytea
├── tag: bytea
├── createdAt: timestamp
└── updatedAt: timestamp
```

### 2.2 Relationships

```
User 1───* Project (ownership)
User 1───* ProjectMember
Project 1───* ProjectMember
Project 1───* WorkItem
Project 1───* Repository
Repository 1───* WorkItem
Repository 1───* ContextBoundary
WorkItem 1───* ContextBoundary
WorkItem 1───* Specification
WorkItem 1───* AgentPrompt
WorkItem 1───* Execution
Execution 1───* Verification
Verification 1───* Evidence
User 1───* EncryptedCredential
```

---

## 3. Workflow Model

### 3.1 Work Item Lifecycle

```
┌─────────┐
│  Idea   │ Initial capture
└────┬────┘
     ▼
┌─────────┐
│Planning │ AI-assisted specification
└────┬────┘
     ▼
┌─────────┐
│  Ready  │ Approved for execution
└────┬────┘
     ▼
┌─────────┐
│Executing│ Agent/coding work
└────┬────┘
     ▼
┌─────────┐
│Verification│ Evidence-based validation
└────┬────┘
     ▼
┌─────────┐
│  Done   │ Verified complete
└─────────┘
```

### 3.2 Kanban Column Mapping

| UI Column | Domain Status | Description |
|-----------|---------------|-------------|
| 📥 Ideas | `idea` | Initial capture |
| 🧠 Planning | `planning` | AI-assisted specification |
| 🤖 Ready | `ready` | Approved for execution |
| 👀 Review | `verification` | Under verification |
| ✅ Done | `done` | Verified complete |

---

## 4. API Contract

### 4.1 Standard Response

**Success:**
```json
{
  "data": {},
  "error": null,
  "meta": {
    "page": 1,
    "total": 100
  }
}
```

**Failure:**
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  },
  "meta": {}
}
```

### 4.2 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid session |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### 4.3 Endpoints (Target)

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/session

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:id/repositories
POST   /api/projects/:id/repositories
GET    /api/repositories/:id
DELETE /api/repositories/:id

GET    /api/projects/:id/work-items
POST   /api/projects/:id/work-items
GET    /api/work-items/:id
PATCH  /api/work-items/:id
DELETE /api/work-items/:id

POST   /api/work-items/:id/specifications
POST   /api/work-items/:id/agent-prompts
POST   /api/work-items/:id/executions
POST   /api/executions/:id/verifications

GET    /api/github/repositories/:id/tree
GET    /api/github/repositories/:id/issues
POST   /api/github/repositories/:id/sync

POST   /api/ai/chat
POST   /api/ai/generate-spec
POST   /api/ai/generate-prompt
```

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
Browser                    AgentPM API              Database
   │                           │                       │
   │── POST /auth/login ──────►│                       │
   │                           │── validate user ─────►│
   │                           │◄── user record ──────│
   │                           │                       │
   │                           │── create session ───►│
   │◄── HttpOnly cookie ──────│                       │
   │                           │                       │
   │── API request + cookie ──►│                       │
   │                           │── validate session ──►│
   │                           │◄── session valid ────│
   │                           │                       │
   │                           │── authorize action    │
   │◄── response ─────────────│                       │
```

### 5.2 Credential Storage

```
User Input
    │
    ▼
Server Memory (ephemeral)
    │
    ▼
Encrypt (AES-256-GCM)
    │
    ▼
Database (encrypted at rest)
    │
    ▼
Decrypt only when needed for API call
    │
    ▼
Never logged, never returned to client
```

### 5.3 Authorization Model

```
Request
  │
  ▼
Authenticate (session cookie → userId)
  │
  ▼
Resolve resource (projectId, workItemId, etc.)
  │
  ▼
Check membership (ProjectMember table)
  │
  ▼
Check permission (role-based: owner/editor/viewer)
  │
  ▼
Validate input (Zod schema)
  │
  ▼
Execute operation
```

---

## 6. Integration Architecture

### 6.1 GitHub Adapter

```
GitHubAdapter
    │
    ├── listRepositories()
    ├── getRepositoryTree(owner, repo, branch)
    │       └── Handle truncated response
    ├── listIssues(owner, repo)
    ├── getIssue(owner, repo, number)
    ├── createWebhook(owner, repo, events)
    └── handleWebhook(payload)
```

### 6.2 AI Provider Interface

```
AIProvider
    │
    ├── generate(request: AIRequest): AIResponse
    ├── stream(request: AIRequest): AsyncIterable<string>
    └── getModels(): ModelInfo[]
    │
    ├── OpenAIProvider
    │       └── gpt-4o, gpt-4o-mini, etc.
    │
    └── Future: AnthropicProvider, etc.
```

---

## 7. Component Architecture (Target)

### 7.1 RepositoryExplorer Decomposition

```
RepositoryExplorer (orchestrator)
├── RepositoryToolbar
│       ├── SearchInput
│       ├── CategoryFilter
│       ├── ViewControls (zoom, pan, reset)
│       └── RefreshButton
│
├── RepositoryCanvas
│       ├── SvgLayer (edges, lines)
│       ├── NodeLayer (positioned nodes)
│       └── EnclosureLayer (folder groups)
│
├── RepositoryNode
│       ├── FolderNode
│       └── FileNode
│
├── RepositoryEdge
│       ├── StructureEdge (solid)
│       └── DependencyEdge (dashed, colored)
│
├── RepositoryStats
│       └── File/Folder/Active counts
│
└── RepositoryDetails
        └── Tooltip (path, status, actions)
```

### 7.2 TaskDetailDrawer Decomposition

```
TaskDetailDrawer (orchestrator)
├── TaskDetails
│       ├── Title
│       ├── Description
│       ├── StatusBadge
│       └── Metadata
│
├── TaskContext
│       ├── ContextBoundaryList
│       └── RepositoryLink
│
├── TaskPrompt
│       ├── PromptEditor
│       ├── CopyButton
│       └── VersionHistory
│
├── AIPlanner
│       ├── ChatInterface
│       ├── MessageList
│       └── PromptInput
│
└── TaskActions
        ├── MoveStatus
        ├── EditTask
        └── DeleteTask
```

---

## 8. Testing Strategy

### 8.1 Test Layers

| Layer | Scope | Tools | Priority |
|-------|-------|-------|----------|
| Unit | Domain functions, utilities | Vitest | P0 |
| Integration | API routes, database | Vitest + test DB | P0 |
| Component | React interactions | Testing Library | P1 |
| API | Endpoint behavior | Supertest | P0 |
| E2E | Critical workflows | Playwright | P2 |
| Accessibility | WCAG checks | axe-core | P1 |

### 8.2 Critical Test Scenarios

1. **Authentication:** Register, login, logout, session expiry
2. **Authorization:** Cross-project access denied, role enforcement
3. **Work Items:** Create, update, move status, delete
4. **GitHub Integration:** Tree fetch, issue sync, credential handling
5. **AI Integration:** Chat, spec generation, prompt approval
6. **Repository Visualization:** Node rendering, dependency detection, truncation handling

---

## 9. Infrastructure

### 9.1 Development

```yaml
Runtime: Next.js 16.3.5
Database: Neon/PostgreSQL (dev instance)
Auth: Custom session (dev mode)
Storage: Local filesystem
CI: GitHub Actions
```

### 9.2 Production (Target)

```yaml
Runtime: Next.js 16.x (Vercel or similar)
Database: Neon/PostgreSQL (production)
Auth: Custom session (Redis-backed)
Storage: S3-compatible (for evidence/screenshots)
CI: GitHub Actions
Monitoring: Sentry + Vercel Analytics
```

---

## 10. Migration Strategy

### Phase 0 (Current)
- [x] Architecture document created
- [x] Constitution reconciled (v1.1.0)
- [ ] Domain schema finalized
- [ ] API contract implemented
- [ ] Test infrastructure established

### Phase 1 (Security Foundation)
- [ ] Implement User/Session models
- [ ] Add authentication endpoints
- [ ] Implement authorization middleware
- [ ] Migrate credentials to encrypted storage
- [ ] Add CSRF protection
- [ ] Add rate limiting

### Phase 2 (Domain + Persistence)
- [ ] Set up Neon/PostgreSQL
- [ ] Implement database migrations
- [ ] Create domain services
- [ ] Migrate localStorage state to database
- [ ] Add project/work item CRUD

### Phase 3 (API Foundation)
- [ ] Standardize all API responses
- [ ] Add Zod validation to all endpoints
- [ ] Implement service boundaries
- [ ] Add GitHub adapter abstraction
- [ ] Add AI provider abstraction

### Phase 4 (Testing)
- [ ] Set up Vitest + Testing Library
- [ ] Write unit tests for domain logic
- [ ] Write integration tests for API
- [ ] Write component tests
- [ ] Set up CI gates

### Phase 5-8
- [ ] UI decomposition
- [ ] Repository intelligence
- [ ] AI planner
- [ ] Advanced features

---

## 11. Open Decisions

| Decision | Status | Impact |
|----------|--------|--------|
| Next.js version | Resolved: Stay on 16.x | Low |
| File length limit | Resolved: 300 lines enforced | Medium (requires refactor) |
| Auth approach | Resolved: Custom session | High |
| Database | Resolved: Neon/PostgreSQL | High |
| Phase 0 tracking | Resolved: Documentation only | Low |

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large repository tree truncation | High | Medium | Implement pagination/targeted retrieval |
| Credential migration breaks existing users | Medium | High | Graceful migration + fallback |
| AI provider API changes | Medium | Low | Provider abstraction layer |
| Database migration complexity | Medium | Medium | Use migration tool (Drizzle/Prisma) |

---

**Document Version:** 1.0.0
**Next Review:** After Phase 1 completion
