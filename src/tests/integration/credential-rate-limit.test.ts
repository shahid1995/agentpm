import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "../../lib/db/index";
import { makeRequest, createSession } from "./api-boundary.test";
import { POST as credentialsPOST, GET as credentialsGET, DELETE as credentialsDELETE } from "../../app/api/credentials/route";

/**
 * Credential API rate-limiting boundary tests (Issue #2 finding 1).
 * Credential operations use the sensitive tier (10/min per user).
 * No timing/sleep dependencies — the cap is driven deterministically.
 */

const ENCRYPTION_KEY = "a".repeat(64);

function storeRequest(session: { sessionToken: string; csrfToken: string }) {
  return makeRequest("/api/credentials", {
    body: { provider: "github", value: "ghp_rl_secret" },
    cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
    headers: { "x-csrf-token": session.csrfToken },
  });
}

describe("Credential API rate limiting", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rate-limits POST /api/credentials with 429 RATE_LIMITED after the cap", async () => {
    const session = await createSession();
    let sawRateLimited = false;
    // sensitive tier: 10/min per user key
    for (let i = 0; i < 12; i++) {
      const response = await credentialsPOST(storeRequest(session));
      if (response.status === 429) {
        const body = await response.json();
        expect(body.error.code).toBe("RATE_LIMITED");
        expect(body.data).toBeNull();
        sawRateLimited = true;
        break;
      }
    }
    expect(sawRateLimited).toBe(true);
  });

  it("rate-limits GET /api/credentials with 429 RATE_LIMITED after the cap", async () => {
    const session = await createSession();
    let sawRateLimited = false;
    for (let i = 0; i < 12; i++) {
      const request = makeRequest("/api/credentials", {
        method: "GET",
        cookies: { agentpm_session: session.sessionToken },
      });
      const response = await credentialsGET(request);
      if (response.status === 429) {
        const body = await response.json();
        expect(body.error.code).toBe("RATE_LIMITED");
        sawRateLimited = true;
        break;
      }
    }
    expect(sawRateLimited).toBe(true);
  });

  it("rate-limits DELETE /api/credentials with 429 RATE_LIMITED after the cap", async () => {
    const session = await createSession();
    let sawRateLimited = false;
    for (let i = 0; i < 12; i++) {
      const request = makeRequest("/api/credentials", {
        method: "DELETE",
        body: { credentialId: "00000000-0000-4000-8000-000000000000" },
        cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
        headers: { "x-csrf-token": session.csrfToken },
      });
      const response = await credentialsDELETE(request);
      if (response.status === 429) {
        const body = await response.json();
        expect(body.error.code).toBe("RATE_LIMITED");
        sawRateLimited = true;
        break;
      }
    }
    expect(sawRateLimited).toBe(true);
  });

  it("rate limiting does not weaken authentication — unauthenticated requests still 401", async () => {
    // Exhaust the limiter for a distinct session first
    const session = await createSession();
    for (let i = 0; i < 12; i++) {
      const response = await credentialsPOST(storeRequest(session));
      if (response.status === 429) break;
    }

    // An unauthenticated request is rejected as UNAUTHORIZED, not RATE_LIMITED
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_anon" },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rate limiting does not break cross-user isolation — another user still operates normally", async () => {
    // Exhaust user A's limiter
    const userA = await createSession();
    for (let i = 0; i < 12; i++) {
      const response = await credentialsPOST(storeRequest(userA));
      if (response.status === 429) break;
    }

    // User B (separate key) can still store and list their own credentials
    const userB = await createSession();
    const storeResponse = await credentialsPOST(storeRequest(userB));
    expect([200, 201]).toContain(storeResponse.status);

    const listRequest = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: userB.sessionToken },
    });
    const listResponse = await credentialsGET(listRequest);
    expect(listResponse.status).toBe(200);
    const body = await listResponse.json();
    expect(body.data.credentials.length).toBeGreaterThan(0);
    // User B must never see user A's secret
    expect(JSON.stringify(body)).not.toContain("ghp_rl_secret");
  });
});
