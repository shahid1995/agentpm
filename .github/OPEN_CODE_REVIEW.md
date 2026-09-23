# OpenCodeReview GitHub PR Reviewer — AgentPM

OpenCodeReview is installed as an independent GitHub Actions reviewer for AgentPM.

## Scope
- Next.js 16 App Router / TypeScript
- Custom session authentication and authorization
- Encrypted GitHub/OpenAI credentials
- Zod API validation
- Drizzle/PostgreSQL/PGlite persistence
- GitHub and AI provider boundaries
- Vitest regression/security coverage

## Triggers
Automatic: `pull_request_target` on opened, synchronize, reopened, ready_for_review.

Manual: exact comment `/open-code-review` or `@open-code-review` on a pull request by OWNER/MEMBER/COLLABORATOR.

## Security
Permissions:
```yaml
permissions:
  contents: read
  pull-requests: write
```

The manual path resolves PR metadata through `actions/github-script@v9` and does not execute PR-controlled code before the reviewer step.

## OpenRouter configuration
Configure these in **Settings → Secrets and variables → Actions**:
- `OCR_LLM_URL` — `https://openrouter.ai/api/v1/chat/completions`
- `OCR_LLM_AUTH_TOKEN` — OpenRouter API key (Secret)
- `OCR_LLM_MODEL` — e.g. `openai/gpt-4o` (Variable)
- `OCR_LLM_USE_ANTHROPIC` — `false` (Variable)

No credential is committed to the repository.

## Reviewer behavior
- High-effort analysis
- Incremental review
- Sticky summary
- Inline findings
- Artifacts
- Repository-aware context
- AgentPM-specific rules in `.github/open-code-review-rules.json`

OpenCodeReview does not modify source code, merge PRs, deploy, or redefine AgentPM architecture.

<!-- OpenCodeReview smoke-test marker: inert documentation-only change -->
