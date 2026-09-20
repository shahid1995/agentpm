import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/lib/db/index";
import { AuthService } from "@/lib/services/auth-service";
import { CredentialService } from "@/lib/services/credential-service";

describe("PostgreSQL Auth Persistence", () => {
  let authService: AuthService;
  let credentialService: CredentialService;

  beforeEach(async () => {
    await initDb();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    authService = new AuthService();
    credentialService = new CredentialService();
  });

  describe("User Registration", () => {
    it("should persist user to PostgreSQL", async () => {
      const { user } = await authService.register("persist@test.com", "password123");
      expect(user.id).toBeTruthy();
      expect(user.email).toBe("persist@test.com");

      // Verify user exists in PostgreSQL by logging in
      const loginResult = await authService.login("persist@test.com", "password123");
      expect(loginResult.user.id).toBe(user.id);
    });

    it("should reject duplicate registration", async () => {
      await authService.register("dup@test.com", "password123");
      await expect(
        authService.register("dup@test.com", "password123")
      ).rejects.toThrow();
    });
  });

  describe("Session Persistence", () => {
    it("should persist session to PostgreSQL on login", async () => {
      const { sessionToken } = await authService.register("session@test.com", "password123");

      // Session should be resolvable from PostgreSQL
      const session = await authService.resolveSession(sessionToken);
      expect(session).toBeDefined();
      expect(session?.email).toBe("session@test.com");
    });

    it("should revoke session in PostgreSQL", async () => {
      const { sessionToken } = await authService.register("revoke@test.com", "password123");

      // Verify session works
      const before = await authService.resolveSession(sessionToken);
      expect(before).toBeTruthy();

      // Revoke
      await authService.logout(sessionToken);

      // Verify session is revoked in PostgreSQL
      const after = await authService.resolveSession(sessionToken);
      expect(after).toBeNull();
    });

    it("should survive process restart semantics", async () => {
      const { sessionToken } = await authService.register("restart@test.com", "password123");

      // Simulate restart by creating a new AuthService instance
      const newAuthService = new AuthService();

      // Session should still resolve from PostgreSQL
      const session = await newAuthService.resolveSession(sessionToken);
      expect(session).toBeDefined();
      expect(session?.email).toBe("restart@test.com");
    });
  });

  describe("Credential Persistence", () => {
    it("should persist encrypted credentials to PostgreSQL", async () => {
      const { user } = await authService.register("creds@test.com", "password123");

      const secret = "ghp_PERSISTED_SECRET_12345";
      await credentialService.storeCredential(user.id, "github", secret);

      // Verify credentials are stored (metadata only)
      const creds = await credentialService.getCredentials(user.id);
      expect(creds.length).toBeGreaterThan(0);
      expect(creds[0].provider).toBe("github");
    });

    it("should never expose plaintext in stored credentials", async () => {
      const { user } = await authService.register("secret@test.com", "password123");

      const secret = "sk-openai-ULTRA_SECRET";
      await credentialService.storeCredential(user.id, "openai", secret);

      // Get credentials from database
      const creds = await credentialService.getCredentials(user.id);
      const serialized = JSON.stringify(creds);

      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain("ULTRA");
    });
  });

  describe("Authorization Enforcement", () => {
    it("should enforce persisted session validity", async () => {
      const { sessionToken: token1 } = await authService.register("user1@test.com", "pass");
      const { sessionToken: token2 } = await authService.register("user2@test.com", "pass");

      // Both sessions should be valid
      const session1 = await authService.resolveSession(token1);
      const session2 = await authService.resolveSession(token2);

      expect(session1).toBeTruthy();
      expect(session2).toBeTruthy();

      // Different users
      expect(session1?.userId).not.toBe(session2?.userId);
    });
  });
});
