import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "../../lib/db/index";
import { makeRequest, createSession } from "./api-boundary.test";
import { POST as credentialsPOST } from "../../app/api/credentials/route";
import { POST as chatgptPOST } from "../../app/api/chatgpt/route";

/**
 * Request-size enforcement regression tests (Issue #2 finding 2).
 * The shared enforceRequestSize() must reject an oversized body even when
 * Content-Length is absent, understated, or unparseable — the actual
 * received body is measured via a clone, and normal requests remain
 * readable by the route afterwards.
 */

const ENCRYPTION_KEY = "a".repeat(64);
const ONE_MB = 1024 * 1024;

/** Build a JSON body whose serialized size exceeds 1 MiB. */
function oversizedBody(): { provider: string; value: string } {
  return { provider: "github", value: "x".repeat(ONE_MB + 4096) };
}

describe("Request-size enforcement without usable Content-Length", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("rejects oversized POST /api/credentials with no Content-Length (400 VALIDATION_ERROR)", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: oversizedBody(),
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken, "content-length": "" },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("large");
  });

  it("rejects oversized /api/chatgpt with no Content-Length", async () => {
    const session = await createSession();
    const bigMessages = [{ role: "user" as const, content: "y".repeat(ONE_MB + 4096) }];
    const request = makeRequest("/api/chatgpt", {
      body: { messages: bigMessages, taskContext: null },
      cookies: { agentpm_session: session.sessionToken },
      headers: { "content-length": "" },
    });
    const response = await chatgptPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects oversized body with understated Content-Length", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: oversizedBody(),
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      // Declared length far below the real body size — must not be trusted
      headers: { "x-csrf-token": session.csrfToken, "content-length": "100" },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects oversized body with unparseable Content-Length", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: oversizedBody(),
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken, "content-length": "not-a-number" },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retains rejection for explicitly oversized Content-Length", async () => {
    const session = await createSession();
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_small" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken, "content-length": String(ONE_MB + 1) },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("normal-sized requests remain readable by the route after the size check", async () => {
    const session = await createSession();
    // No Content-Length header at all — body must still parse and persist
    const request = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_normal_size" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken, "content-length": "" },
    });
    const response = await credentialsPOST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.provider).toBe("github");
  });
});
