import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "../../lib/db/index";
import { CredentialService } from "../../lib/services/credential-service";
import { getEncryptedCredentialById, getEncryptedCredentials } from "../../lib/db/repositories";
import { makeRequest, createSession } from "./api-boundary.test";
import { POST as credentialsPOST, GET as credentialsGET, DELETE as credentialsDELETE } from "../../app/api/credentials/route";

/**
 * Two-user credential isolation regression tests (PR #1 verification finding).
 * Proves user B cannot read or delete user A's credentials by ID,
 * at both the repository layer and the HTTP boundary.
 */

const ENCRYPTION_KEY = "a".repeat(64);

describe("Two-user credential isolation — repository layer", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    await initDb();
  });

  it("user B cannot read user A's credential by ID", async () => {
    const userA = await createSession();
    const userB = await createSession();

    // User A stores a credential
    const storeRequest = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_userA_secret" },
      cookies: { agentpm_session: userA.sessionToken, agentpm_csrf: userA.csrfToken },
      headers: { "x-csrf-token": userA.csrfToken },
    });
    const storeResponse = await credentialsPOST(storeRequest);
    expect(storeResponse.status).toBe(201);
    const storeBody = await storeResponse.json();
    const credentialId = storeBody.data.id;

    // User B attempts to read it by ID — must get null
    const leaked = await getEncryptedCredentialById(credentialId, userB.userId);
    expect(leaked).toBeNull();

    // User A can still read it
    const own = await getEncryptedCredentialById(credentialId, userA.userId);
    expect(own).not.toBeNull();
  });

  it("user B cannot delete user A's credential by ID", async () => {
    const userA = await createSession();
    const userB = await createSession();

    const storeRequest = makeRequest("/api/credentials", {
      body: { provider: "github", value: "ghp_userA_delete_target" },
      cookies: { agentpm_session: userA.sessionToken, agentpm_csrf: userA.csrfToken },
      headers: { "x-csrf-token": userA.csrfToken },
    });
    const storeResponse = await credentialsPOST(storeRequest);
    const storeBody = await storeResponse.json();
    const credentialId = storeBody.data.id;

    // User B attempts to delete via HTTP boundary — must be NOT_FOUND
    const deleteRequest = makeRequest("/api/credentials", {
      method: "DELETE",
      body: { credentialId },
      cookies: { agentpm_session: userB.sessionToken, agentpm_csrf: userB.csrfToken },
      headers: { "x-csrf-token": userB.csrfToken },
    });
    const deleteResponse = await credentialsDELETE(deleteRequest);
    expect(deleteResponse.status).toBe(404);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.error.code).toBe("NOT_FOUND");

    // Credential must still exist and still belong to user A
    const creds = await getEncryptedCredentials(userA.userId);
    const survived = creds.find((c) => c.id === credentialId);
    expect(survived).toBeDefined();

    // User A deletes own credential — succeeds
    const ownDeleteRequest = makeRequest("/api/credentials", {
      method: "DELETE",
      body: { credentialId },
      cookies: { agentpm_session: userA.sessionToken, agentpm_csrf: userA.csrfToken },
      headers: { "x-csrf-token": userA.csrfToken },
    });
    const ownDeleteResponse = await credentialsDELETE(ownDeleteRequest);
    expect(ownDeleteResponse.status).toBe(200);
  });

  it("GET only lists the caller's own credentials", async () => {
    const userA = await createSession();
    const userB = await createSession();

    // Both users store credentials
    for (const [session, provider, value] of [
      [userA, "github", "ghp_A_only"],
      [userB, "github", "ghp_B_only"],
    ] as const) {
      const storeRequest = makeRequest("/api/credentials", {
        body: { provider, value },
        cookies: { agentpm_session: session.sessionToken, agentpm_csrf: session.csrfToken },
        headers: { "x-csrf-token": session.csrfToken },
      });
      const res = await credentialsPOST(storeRequest);
      expect(res.status).toBe(201);
    }

    // User B lists — must see only their own, never user A's
    const listRequest = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: userB.sessionToken },
    });
    const listResponse = await credentialsGET(listRequest);
    expect(listResponse.status).toBe(200);
    const body = await listResponse.json();
    expect(body.data.credentials).toHaveLength(1);
    const text = JSON.stringify(body);
    expect(text).not.toContain("ghp_A_only");

    // User A lists — sees own
    const listARequest = makeRequest("/api/credentials", {
      method: "GET",
      cookies: { agentpm_session: userA.sessionToken },
    });
    const listAResponse = await credentialsGET(listARequest);
    const bodyA = await listAResponse.json();
    expect(bodyA.data.credentials).toHaveLength(1);
    expect(JSON.stringify(bodyA)).not.toContain("ghp_B_only");
  });

  it("server-side resolution never crosses users (provider lookup)", async () => {
    const userA = await createSession();
    const userB = await createSession();

    // Only user A has a GitHub credential
    const credentialService = new CredentialService();
    await credentialService.storeCredential(userA.userId, "github", "ghp_A_provider_secret");

    // User B's provider lookup must return null
    const resolvedForB = await credentialService.getDecryptedCredential(userB.userId, "github");
    expect(resolvedForB).toBeNull();

    // User A's provider lookup returns their own secret
    const resolvedForA = await credentialService.getDecryptedCredential(userA.userId, "github");
    expect(resolvedForA).toBe("ghp_A_provider_secret");
  });
});
