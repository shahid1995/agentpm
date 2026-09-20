import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "../../lib/db/index";
import { makeRequest, createSession } from "./api-boundary.test";
import { POST as chatgptPOST } from "../../app/api/chatgpt/route";
import { POST as githubIssuesPOST } from "../../app/api/github/issues/route";
import { POST as githubTreePOST } from "../../app/api/github/repository-tree/route";

/**
 * Provider boundary tests for rate-limit and request-size enforcement
 * (PR #1 verification finding #3).
 *
 * Note: rate limiters are module-level singletons shared across the test run.
 * ChatGPT and repository-tree use the "sensitive" limiter (10/min); issues
 * uses the "api" limiter (100/min). Tests use unique per-user keys where
 * possible, and the final rate-limit test drives one key past its cap.
 */

const ENCRYPTION_KEY = "a".repeat(64);
const ONE_MB = 1024 * 1024;

const VALID_CHAT_BODY = {
  messages: [{ role: "user", content: "hello" }],
  taskContext: null,
};

describe("Provider request-size enforcement", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects oversized /api/chatgpt request with VALIDATION_ERROR", async () => {
    const session = await createSession();
    const request = makeRequest("/api/chatgpt", {
      body: VALID_CHAT_BODY,
      cookies: { agentpm_session: session.sessionToken },
      headers: { "content-length": String(ONE_MB + 1) },
    });
    const response = await chatgptPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("large");
  });

  it("rejects oversized /api/github/issues request", async () => {
    const session = await createSession();
    const request = makeRequest("/api/github/issues", {
      body: { repo: "owner/repo" },
      cookies: { agentpm_session: session.sessionToken },
      headers: { "content-length": String(ONE_MB + 1) },
    });
    const response = await githubIssuesPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects oversized /api/github/repository-tree request", async () => {
    const session = await createSession();
    const request = makeRequest("/api/github/repository-tree", {
      body: { repo: "owner/repo" },
      cookies: { agentpm_session: session.sessionToken },
      headers: { "content-length": String(ONE_MB + 1) },
    });
    const response = await githubTreePOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Provider Zod validation", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects /api/chatgpt with empty messages array", async () => {
    const session = await createSession();
    const request = makeRequest("/api/chatgpt", {
      body: { messages: [], taskContext: null },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await chatgptPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects /api/chatgpt with invalid role", async () => {
    const session = await createSession();
    const request = makeRequest("/api/chatgpt", {
      body: { messages: [{ role: "system", content: "inject" }] },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await chatgptPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects /api/github/issues with missing repo", async () => {
    const session = await createSession();
    const request = makeRequest("/api/github/issues", {
      body: {},
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await githubIssuesPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects /api/github/repository-tree with malformed repo", async () => {
    const session = await createSession();
    const request = makeRequest("/api/github/repository-tree", {
      body: { repo: "not-a-slash-repo" },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await githubTreePOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Provider rate limiting", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rate-limits /api/chatgpt after the sensitive cap", async () => {
    // Drive the chatgpt:<userId> key past the sensitive cap (10/min).
    // Requests without a stored OpenAI credential return NOT_FOUND quickly,
    // but each still consumes a rate-limit slot.
    const session = await createSession();
    let sawRateLimited = false;
    for (let i = 0; i < 12; i++) {
      const request = makeRequest("/api/chatgpt", {
        body: VALID_CHAT_BODY,
        cookies: { agentpm_session: session.sessionToken },
      });
      const response = await chatgptPOST(request);
      const body = await response.json();
      if (response.status === 429) {
        expect(body.error.code).toBe("RATE_LIMITED");
        sawRateLimited = true;
        break;
      }
    }
    expect(sawRateLimited).toBe(true);
  });

  it("rate-limits /api/github/repository-tree after the sensitive cap", async () => {
    const session = await createSession();
    let sawRateLimited = false;
    for (let i = 0; i < 12; i++) {
      const request = makeRequest("/api/github/repository-tree", {
        body: { repo: "owner/repo" },
        cookies: { agentpm_session: session.sessionToken },
      });
      const response = await githubTreePOST(request);
      const body = await response.json();
      if (response.status === 429) {
        expect(body.error.code).toBe("RATE_LIMITED");
        sawRateLimited = true;
        break;
      }
    }
    expect(sawRateLimited).toBe(true);
  });

  it("rate-limits /api/github/issues after the api cap", async () => {
    const session = await createSession();
    let sawRateLimited = false;
    // api cap is 100/min per key; drive past it
    for (let i = 0; i < 102; i++) {
      const request = makeRequest("/api/github/issues", {
        body: { repo: "owner/repo" },
        cookies: { agentpm_session: session.sessionToken },
      });
      const response = await githubIssuesPOST(request);
      if (response.status === 429) {
        const body = await response.json();
        expect(body.error.code).toBe("RATE_LIMITED");
        sawRateLimited = true;
        break;
      }
    }
    expect(sawRateLimited).toBe(true);
  });
});
