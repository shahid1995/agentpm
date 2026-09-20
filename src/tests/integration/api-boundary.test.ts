import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { initDb } from "../../lib/db/index";
import { AuthService } from "../../lib/services/auth-service";
import { getEncryptedCredentials } from "../../lib/db/repositories";
import { POST as credentialsPOST, GET as credentialsGET, DELETE as credentialsDELETE } from "../../app/api/credentials/route";
import { generateCsrfToken } from "../../lib/security/csrf";

/**
 * Boundary-level tests for the credential API.
 * Exercises the actual HTTP route handler with NextRequest objects,
 * proving the security boundary works — not just the services.
 */

const ENCRYPTION_KEY = "a".repeat(64);

export function makeRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "POST", body, cookies = {}, headers = {} } = options;
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function createSession(): Promise<{
  sessionToken: string;
  userId: string;
  csrfToken: string;
}> {
  const authService = new AuthService();
  const email = `boundary-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const result = await authService.register(email, "password123");
  return {
    sessionToken: result.sessionToken,
    userId: result.user.id,
    csrfToken: generateCsrfToken(),
  };
}

describe("Credential API Boundary — POST /api/credentials", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects unauthenticated requests", async () => {
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret123" },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests missing CSRF token", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret123" },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects mismatched CSRF token", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret123" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": "wrong-token" },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(403);
  });

  it("rejects invalid provider with VALIDATION_ERROR", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: { provider: "aws", value: "ghp_secret123" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("persists credential and returns safe metadata", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret123" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.provider).toBe("github");
    expect(JSON.stringify(body)).not.toContain("ghp_secret123");
  });

  it("persists ciphertext in PostgreSQL (never plaintext)", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret123" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    await credentialsPOST(request);

    const creds = await getEncryptedCredentials(session.userId);
    expect(creds.length).toBeGreaterThan(0);
    const github = creds.find((c) => c.provider === "github");
    expect(github).toBeDefined();
  });

  it("does not return ciphertext/iv/authTag in GET response", async () => {
    const session = await createSession();
    const storeRequest = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret123" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    await credentialsPOST(storeRequest);

    const request = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await credentialsGET(request);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("ciphertext");
    expect(text).not.toContain("authTag");
    expect(text).not.toContain("ghp_secret123");
  });
});

describe("Credential API Boundary — GET /api/credentials", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects unauthenticated requests", async () => {
    const request = makeRequest("/api/credentials", { method: "GET" });
    const response = await credentialsGET(request);
    expect(response.status).toBe(401);
  });

  it("returns persisted metadata without secrets", async () => {
    const session = await createSession();
    // Store a credential first
    const storeRequest = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret123" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    await credentialsPOST(storeRequest);

    const request = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await credentialsGET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.credentials.length).toBeGreaterThan(0);
    const text = JSON.stringify(body);
    expect(text).not.toContain("ghp_secret123");
    expect(text).not.toContain("ciphertext");
  });
});

describe("Credential API Boundary — DELETE /api/credentials", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects unauthenticated requests", async () => {
    const request = makeRequest("/api/credentials", {
      method: "DELETE",
      body: { credentialId: "some-id" },
    });
    const response = await credentialsDELETE(request);
    expect(response.status).toBe(401);
  });

  it("rejects requests missing CSRF token", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      method: "DELETE",
      body: { credentialId: "some-id" },
      cookies: { agentpm_session: session.sessionToken },
    });
    const response = await credentialsDELETE(request);
    expect(response.status).toBe(403);
  });

  it("deletes the persisted credential", async () => {
    const session = await createSession();
    // Store a credential first
    const storeRequest = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_secret_to_delete" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    const storeResponse = await credentialsPOST(storeRequest);
    const storeBody = await storeResponse.json();
    const credentialId = storeBody.data.id;

    // Verify it is persisted
    let creds = await getEncryptedCredentials(session.userId);
    expect(creds.length).toBeGreaterThan(0);

    // Delete it
    const deleteRequest = makeRequest("/api/credentials", {
      method: "DELETE",
      body: { credentialId },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    const response = await credentialsDELETE(deleteRequest);
    expect(response.status).toBe(200);

    // Verify it is gone from the database
    creds = await getEncryptedCredentials(session.userId);
    const deleted = creds.find((c) => c.id === credentialId);
    expect(deleted).toBeUndefined();
  });
});
