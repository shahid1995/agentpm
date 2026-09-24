import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "../../lib/db/index";
import { CredentialService } from "../../lib/services/credential-service";
import { POST as chatgptPOST } from "../../app/api/chatgpt/route";
import { POST as githubIssuesPOST } from "../../app/api/github/issues/route";
import { POST as githubTreePOST } from "../../app/api/github/repository-tree/route";
import { makeRequest, createSession } from "./api-boundary.test";

/**
 * Boundary-level tests for integration provider routes.
 * Proves the browser can no longer supply provider secrets:
 * credentials must be resolved server-side from encrypted storage.
 */

const ENCRYPTION_KEY = "a".repeat(64);

describe("OpenAI Route Boundary — POST /api/chatgpt", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects unauthenticated requests", async () => {
    const request = makeRequest("/api/chatgpt", {
      body: {
        messages: [{ role: "user", content: "hello" }],
        taskContext: null,
      },
    });
    const response = await chatgptPOST(request);
    expect(response.status).toBe(401);
  });

  it("rejects browser-supplied API key — server ignores request-body key", async () => {
    const session = await createSession();
    const request = makeRequest("/api/chatgpt", {
      body: {
        messages: [{ role: "user", content: "hello" }],
        taskContext: null,
        apiKey: "sk-injected-browser-key", // must be ignored
      },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await chatgptPOST(request);
    // Without a stored server-side credential, must fail — never use the injected key
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("sk-injected-browser-key");
    expect(response.status).not.toBe(200);
  });

  it("resolves stored server-side credential and does not leak it", async () => {
    const session = await createSession();
    // Store an OpenAI credential server-side (invalid key so OpenAI rejects, proving server resolution)
    const credentialService = new CredentialService();
    await credentialService.storeCredential(session.userId, "openai", "sk-server-side-test");

    const request = makeRequest("/api/chatgpt", {
      body: {
        messages: [{ role: "user", content: "hello" }],
        taskContext: null,
      },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await chatgptPOST(request);
    const text = await response.text();
    expect(text).not.toContain("sk-server-side-test");
  });
});

describe("GitHub Issues Route Boundary — POST /api/github/issues", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects unauthenticated requests", async () => {
    const request = makeRequest("/api/github/issues", {
      body: { repo: "owner/repo" },
    });
    const response = await githubIssuesPOST(request);
    expect(response.status).toBe(401);
  });

  it("rejects browser-supplied tokens — server ignores request-body token", async () => {
    const session = await createSession();
    const request = makeRequest("/api/github/issues", {
      body: {
        repo: "owner/repo",
        token: "ghp_injected_browser_token", // must be ignored
      },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await githubIssuesPOST(request);
    const text = await response.text();
    expect(text).not.toContain("ghp_injected_browser_token");
    expect(response.status).not.toBe(200);
  });

  it("returns NOT_FOUND when no stored GitHub credential exists", async () => {
    const session = await createSession();
    // Ensure no GitHub credential exists for this user
    const credentialService = new CredentialService();
    const existing = await credentialService.getCredentials(session.userId);
    for (const cred of existing) {
      if (cred.provider === "github") {
        await credentialService.deleteCredential(cred.id, session.userId);
      }
    }
    const request = makeRequest("/api/github/issues", {
      body: { repo: "owner/repo" },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await githubIssuesPOST(request);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GitHub Repository Tree Route Boundary — POST /api/github/repository-tree", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects unauthenticated requests", async () => {
    const request = makeRequest("/api/github/repository-tree", {
      body: { repo: "owner/repo" },
    });
    const response = await githubTreePOST(request);
    expect(response.status).toBe(401);
  });

  it("rejects browser-supplied tokens — server ignores request-body token", async () => {
    const session = await createSession();
    const request = makeRequest("/api/github/repository-tree", {
      body: {
        repo: "owner/repo",
        token: "ghp_injected_browser_token", // must be ignored
      },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await githubTreePOST(request);
    const text = await response.text();
    expect(text).not.toContain("ghp_injected_browser_token");
    expect(response.status).not.toBe(200);
  });

  it("returns NOT_FOUND when no stored GitHub credential exists", async () => {
    const session = await createSession();
    // Ensure no GitHub credential exists for this user
    const credentialService = new CredentialService();
    const existing = await credentialService.getCredentials(session.userId);
    for (const cred of existing) {
      if (cred.provider === "github") {
        await credentialService.deleteCredential(cred.id, session.userId);
      }
    }
    const request = makeRequest("/api/github/repository-tree", {
      body: { repo: "owner/repo" },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await githubTreePOST(request);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
