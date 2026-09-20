# AgentPM Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)
- All code must be TypeScript with strict mode enabled
- No `any` types — use proper type definitions or generics
- Functions must be pure where possible; side effects isolated and documented
- Maximum function length: 40 lines; maximum file length: 300 lines (excluding imports)
- All public APIs must have JSDoc comments
- ESLint must pass with zero warnings before any commit

### II. Test-First Development (NON-NEGOTIABLE)
- TDD cycle strictly enforced: Red → Green → Refactor
- Unit tests required for all business logic, hooks, and utility functions
- Integration tests required for all API routes and component interactions
- Minimum 80% code coverage for production code
- Tests must be deterministic, isolated, and fast (< 2s per test file)
- No mocking of internal implementation details — test behavior, not structure

### III. Modern Next.js 15 Principles
- Use App Router exclusively — no Pages Router patterns
- Server Components by default; Client Components only when necessary (interactivity, browser APIs)
- Use React Server Actions for form submissions and data mutations
- Leverage `use()` hook and Suspense for async data fetching in Client Components
- Implement proper loading.tsx, error.tsx, and not-found.tsx boundaries
- Use `next/font` for all typography — no external font CDNs
- Optimize images with next/image; use priority prop for above-the-fold images
- Implement proper metadata API for SEO on all public pages

### IV. Clean UI Design (NON-NEGOTIABLE)
- UI must be accessible (WCAG 2.1 AA compliant)
- Use semantic HTML elements correctly
- Keyboard navigation must work for all interactive elements
- Color contrast ratio minimum 4.5:1 for normal text, 3:1 for large text
- Focus indicators must be visible and clear
- Responsive design: mobile-first approach, works on all screen sizes
- Consistent spacing using Tailwind's design tokens (4px base grid)
- No custom CSS when Tailwind utilities suffice
- Dark mode support required for all components

### V. State Management
- Local state with useState for component-specific state
- Context API for shared state across a feature (no prop drilling beyond 2 levels)
- Server state with React Query or SWR for API data
- URL state for shareable UI state (filters, pagination, search)
- No global state library (Redux, Zustand) until proven necessary

### VI. Performance & Optimization
- Core Web Vitals must be green (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Code splitting with dynamic imports for routes and heavy components
- Lazy load below-the-fold content and images
- Minimize bundle size: no unnecessary dependencies, tree-shakeable imports
- Use React.memo, useMemo, and useCallback only when profiling shows benefit
- Database queries must be optimized; N+1 queries are forbidden

## Additional Constraints

### Security
- All user input must be validated and sanitized (Zod for schemas)
- No secrets in client-side code or environment variables prefixed with NEXT_PUBLIC_
- Implement proper CORS policies for API routes
- Use HttpOnly cookies for authentication tokens
- CSRF protection for all state-changing operations

### Database & API
- Use parameterized queries only — no raw SQL string concatenation
- Implement proper error boundaries and user-friendly error messages
- API responses must follow consistent JSON structure: { data, error, meta }
- Rate limiting on all public API endpoints
- Database migrations must be reversible

### Git & Collaboration
- Branch naming: `feat/`, `fix/`, `chore/`, `refactor/`, `test/`
- Commit messages follow Conventional Commits specification
- PRs require: description, test plan, screenshots for UI changes
- No direct commits to main — all changes via PR with required reviews
- Squash merge for feature branches

## Development Workflow

1. **Specify** → Create spec.md describing the feature
2. **Plan** → Create plan.md with implementation approach
3. **Tasks** → Break plan into actionable tasks.md
4. **Implement** → Execute tasks with TDD
5. **Review** → Self-review against constitution before PR
6. **Merge** → After CI passes and human review approved

## Quality Gates

- [ ] All tests pass (unit + integration)
- [ ] ESLint and TypeScript with zero errors
- [ ] Accessibility audit passes (manual + automated)
- [ ] Performance budget met (bundle size, Core Web Vitals)
- [ ] No console errors or warnings
- [ ] Responsive design verified (mobile, tablet, desktop)
- [ ] Dark mode verified
- [ ] Documentation updated (README, JSDoc, comments)

## Governance

This constitution supersedes all other development practices. Amendments require:
1. Written proposal with rationale
2. Team review and approval
3. Migration plan for existing code
4. Version bump and changelog entry

**Version**: 1.0.0 | **Ratified**: 2026-09-20 | **Last Amended**: 2026-09-20
