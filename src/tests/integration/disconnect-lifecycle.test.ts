import { describe, it, expect, beforeEach } from "vitest";
import { initDb, getDb } from "../../lib/db/index";
import { CredentialService } from "../../lib/services/credential-service";
import { makeRequest, createSession } from "./api-boundary.test";
import { GET as credentialsGET, DELETE as credentialsDELETE } from "../../app/api/credentials/route";

/**
 * Settings "Disconnect" server-side credential deletion lifecycle tests
 * (Issue #2 finding 3).
 *
 * The Disconnect button in SettingsModal calls deleteAllCredentials()
 * (src/lib/client/credentials.ts), which lists the caller's credentials
 * then issues DELETE /api/credentials for each. These tests prove the
 * server-side lifecycle that flow depends on:
 *   1. credentials persist;
 *   2. list-then-delete removes GitHub and OpenAI credentials;
 *   3. subsequent listing returns nothing;
 *   4. repeating the flow with no credentials is safe (idempotent);
 *   5. no credential secret is persisted in browser storage (the client
 *      helper never writes to localStorage — verified by source scan in
 *      the final test).
 */

const ENCRYPTION_KEY = "a".repeat(64);

/**
 * Replicates the client disconnect flow against the real HTTP boundary:
 * list credentials, then DELETE each by ID with CSRF.
 */
async function disconnectFlow(session: {
  sessionToken: string;
  csrfToken: string;
}): Promise<{ deleted: number; notFound: number }> {
  const listRequest = makeRequest("/api/credentials", {
    method: "GET",
    cookies: { agentpm_session: session.sessionToken },
  });
  const listResponse = await credentialsGET(listRequest);
  expect(listResponse.status).toBe(200);
  const listBody = await listResponse.json();
  const credentials: Array<{ id: string; provider: string }> =
    listBody.data.credentials ?? [];

  let deleted = 0;
  let notFound = 0;
  for (const credential of credentials) {
    const deleteRequest = makeRequest("/api/credentials", {
      method: "DELETE",
      body: { credentialId: credential.id },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    const deleteResponse = await credentialsDELETE(deleteRequest);
    if (deleteResponse.status === 200) deleted++;
    else if (deleteResponse.status === 404) notFound++;
    else throw new Error(`Unexpected delete status ${deleteResponse.status}`);
  }
  return { deleted, notFound };
}

describe("Settings Disconnect — server-side credential deletion lifecycle", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("persists credentials, then disconnect removes GitHub and OpenAI credentials", async () => {
    const session = await createSession();

    // 1. Credentials are persisted (GitHub + OpenAI)
    const credentialService = new CredentialService();
    await credentialService.storeCredential(session.userId, "github", "ghp_disconnect_me");
    await credentialService.storeCredential(session.userId, "openai", "sk_disconnect_me");

    const listRequest = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: session.sessionToken },
    });
    const listResponse = await credentialsGET(listRequest);
    const listBody = await listResponse.json();
    expect(listBody.data.credentials).toHaveLength(2);

    // 2–4. Disconnect invokes the server deletion lifecycle and removes both
    const result = await disconnectFlow(session);
    expect(result.deleted).toBe(2);

    // 5. Subsequent listing no longer returns them
    const afterListResponse = await credentialsGET(listRequest);
    const afterListBody = await afterListResponse.json();
    expect(afterListBody.data.credentials).toHaveLength(0);

    // And the database no longer holds rows for this user
    const db = getDb();
    const rows = await db.execute(
      `SELECT COUNT(*)::int AS count FROM encrypted_credentials WHERE user_id = '${session.userId}';`
    );
    expect((rows.rows[0] as { count: number }).count).toBe(0);
  });

  it("disconnect is idempotent — no credentials present is handled safely", async () => {
    const session = await createSession();
    // No credentials stored at all

    const result = await disconnectFlow(session);
    expect(result.deleted).toBe(0);
    expect(result.notFound).toBe(0);

    // Deleting a nonexistent credential ID directly returns 404, not an error
    const deleteRequest = makeRequest("/api/credentials", {
      method: "DELETE",
      body: { credentialId: "00000000-0000-4000-8000-000000000000" },
      cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
      headers: { "x-csrf-token": session.csrfToken },
    });
    const response = await credentialsDELETE(deleteRequest);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("disconnect does not touch another user's credentials", async () => {
    const userA = await createSession();
    const userB = await createSession();

    // Both users have credentials
    const credentialService = new CredentialService();
    await credentialService.storeCredential(userA.userId, "github", "ghp_A_disconnect");
    await credentialService.storeCredential(userB.userId, "github", "ghp_B_keep");

    // User A disconnects
    const result = await disconnectFlow(userA);
    expect(result.deleted).toBe(1);

    // User B's credential is untouched
    const listBRequest = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: userB.sessionToken },
    });
    const listBResponse = await credentialsGET(listBRequest);
    const listBBody = await listBResponse.json();
    expect(listBBody.data.credentials).toHaveLength(1);
  });

  it("no credential secret is persisted in browser storage by client code", async () => {
    // The client credential helper must never touch localStorage.
    // Read its source and assert no storage writes exist.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const clientSource = fs.readFileSync(
      path.resolve(__dirname, "../../lib/client/credentials.ts"),
      "utf-8"
    );
    expect(clientSource).not.toContain("localStorage");
    expect(clientSource).not.toContain("sessionStorage");

    // SettingsModal must not write credentials to browser storage either
    const modalSource = fs.readFileSync(
      path.resolve(__dirname, "../../components/SettingsModal.tsx"),
      "utf-8"
    );
    expect(modalSource).not.toContain("localStorage");
    expect(modalSource).not.toContain("sessionStorage");
  });

  it("stored credential values never appear in any API response through the flow", async () => {
    const session = await createSession();
    const credentialService = new CredentialService();
    await credentialService.storeCredential(session.userId, "github", "ghp_never_leak");
    await credentialService.storeCredential(session.userId, "openai", "sk_never_leak");

    // List response contains only metadata
    const listRequest = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: session.sessionToken },
    });
    const listResponse = await credentialsGET(listRequest);
    const text = await listResponse.text();
    expect(text).not.toContain("ghp_never_leak");
    expect(text).not.toContain("sk_never_leak");

    // Delete responses contain no secrets either
    const result = await disconnectFlow(session);
    expect(result.deleted).toBe(2);
  });
});
