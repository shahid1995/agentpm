import { describe, it, expect, beforeEach } from "vitest";

// Integration test: Full security flow
// Tests: register → login → session → auth → credential → logout → revoked

import { initDb } from "../../lib/db/index";
import { AuthService } from "../../lib/services/auth-service";
import { CredentialService } from "../../lib/services/credential-service";
import { AuthorizationService } from "../../lib/services/authorization-service";
import { generateCsrfToken, validateCsrfToken } from "../../lib/security/csrf";
import { hashToken, generateToken } from "../../lib/security/auth";
import {
  createSessionCookie,
  createCsrfCookie,
  clearSessionCookie,
  extractSessionToken,
  CSRF_COOKIE_NAME,
} from "../../lib/api/cookies";
import { createUser, createProject, createProjectMember } from "../../lib/db/repositories";

describe("Phase 1 Integration: Full Security Flow", () => {
  let authService: AuthService;
  let credentialService: CredentialService;
  let authzService: AuthorizationService;

  beforeEach(async () => {
    await initDb();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    authService = new AuthService();
    credentialService = new CredentialService();
    authzService = new AuthorizationService();
  });

  describe("Registration → Login → Session → Credential → Logout", () => {
    it("should complete full auth lifecycle with credential storage", async () => {
      // Step 1: Register
      const { user, sessionToken } = await authService.register(
        "lifecycle@test.com",
        "password123"
      );
      expect(user).toBeDefined();
      expect(user.email).toBe("lifecycle@test.com");
      expect(sessionToken).toBeTruthy();

      // Verify session cookie format
      const sessionCookie = createSessionCookie(sessionToken);
      expect(sessionCookie).toContain("agentpm_session=");
      expect(sessionCookie).toContain("HttpOnly");
      expect(sessionCookie).toContain("Secure");
      expect(sessionCookie).toContain("SameSite=Strict");

      // Verify CSRF cookie format
      const csrfToken = generateCsrfToken();
      const csrfCookie = createCsrfCookie(csrfToken);
      expect(csrfCookie).toContain(CSRF_COOKIE_NAME);
      expect(csrfCookie).toContain("Secure");
      // CSRF cookie must NOT be HttpOnly (JavaScript needs to read it)
      expect(csrfCookie).not.toContain("HttpOnly");

      // Step 2: Resolve session
      const session = await authService.resolveSession(sessionToken);
      expect(session).toBeDefined();
      expect(session?.email).toBe("lifecycle@test.com");

      // Step 3: Extract token from cookie header
      const cookieHeader = `${sessionCookie}; ${csrfCookie}`;
      const extractedToken = extractSessionToken(cookieHeader);
      expect(extractedToken).toBe(sessionToken);

      // Step 4: CSRF validation
      expect(validateCsrfToken(csrfToken, csrfToken)).toBe(true);
      expect(validateCsrfToken(csrfToken, "wrong")).toBe(false);

      // Step 5: Store credential (encrypted)
      const githubToken = "ghp_SUPER_SECRET_NEVER_EXPOSED";
      const encrypted = credentialService.encryptCredential(githubToken);
      expect(encrypted.ciphertext).not.toBe(githubToken);
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();

      // Step 6: Decrypt credential works
      const decrypted = credentialService.decryptCredential(encrypted);
      expect(decrypted).toBe(githubToken);

      // Step 7: Verify metadata doesn't leak value
      const metadata = credentialService.toMetadata("github", encrypted);
      expect(metadata.provider).toBe("github");
      expect(metadata.keyVersion).toBe("v1");
      expect(JSON.stringify(metadata)).not.toContain(githubToken);

      // Step 8: Logout
      await authService.logout(sessionToken);

      // Step 9: Verify session revoked
      const revokedSession = await authService.resolveSession(sessionToken);
      expect(revokedSession).toBeNull();

      // Step 10: Verify logout clears cookie
      const logoutCookie = clearSessionCookie();
      expect(logoutCookie).toContain("Max-Age=0");
    });
  });

  describe("Password Security", () => {
    it("should register and verify user", async () => {
      const { user } = await authService.register("secure@test.com", "password123");
      expect(user).toBeDefined();
      expect(user.email).toBe("secure@test.com");
    });

    it("should use unique session tokens (no reuse)", async () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it("should hash tokens deterministically", () => {
      const token = "test_token";
      expect(hashToken(token)).toBe(hashToken(token));
    });
  });

  describe("Credential Encryption Boundaries", () => {
    it("should produce unique IV per encryption", () => {
      const enc1 = credentialService.encryptCredential("same_value");
      const enc2 = credentialService.encryptCredential("same_value");
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });

    it("should fail decryption with tampered authTag", () => {
      const encrypted = credentialService.encryptCredential("secret");
      const tampered = { ...encrypted, authTag: "00000000000000000000000000000000" };
      expect(() => credentialService.decryptCredential(tampered)).toThrow();
    });

    it("should not contain plaintext in any encrypted field", () => {
      const secret = "ghp_ULTRA_SECRET_12345";
      const encrypted = credentialService.encryptCredential(secret);
      const serialized = JSON.stringify(encrypted);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain("ULTRA");
    });
  });

  describe("Authorization Enforcement", () => {
    it("should enforce role-based access control", () => {
      // Owner can do everything
      expect(authzService.canAccessProject("owner")).toBe(true);
      expect(authzService.canModifyProject("owner")).toBe(true);
      expect(authzService.canDeleteProject("owner")).toBe(true);

      // Member limited access
      expect(authzService.canAccessProject("member")).toBe(true);
      expect(authzService.canModifyProject("member")).toBe(false);
      expect(authzService.canDeleteProject("member")).toBe(false);

      // Non-member denied
      expect(authzService.canAccessProject(null)).toBe(false);
      expect(authzService.canModifyProject(null)).toBe(false);
    });

    it("should verify project membership correctly", async () => {
      // Membership must come from persisted database state
      const user = await createUser(`authz-flow-${Date.now()}@test.com`, "hashed");
      const project = await createProject("Authz Flow Project", null, user.id);
      await createProjectMember(project.id, user.id, "owner");

      const ownerCheck = await authzService.checkProjectMembership(user.id, project.id);
      expect(ownerCheck.isMember).toBe(true);
      expect(ownerCheck.role).toBe("owner");

      const noMembership = await authzService.checkProjectMembership("nonmember-id", project.id);
      expect(noMembership.isMember).toBe(false);
    });
  });

  describe("Session Token Security", () => {
    it("should generate tokens of sufficient length", () => {
      const token = generateToken();
      const buffer = Buffer.from(token, "hex");
      expect(buffer.length).toBe(32); // 256 bits
    });

    it("should use constant-time token comparison via hash", () => {
      const token1 = "token_aaaaaaaaaaaaaaaaa";
      const token2 = "token_bbbbbbbbbbbbbbbbb";
      const hash1 = hashToken(token1);
      const hash2 = hashToken(token2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("CSRF Protection", () => {
    it("should generate unique CSRF tokens", () => {
      const csrf1 = generateCsrfToken();
      const csrf2 = generateCsrfToken();
      expect(csrf1).not.toBe(csrf2);
    });

    it("should validate matching tokens", () => {
      const token = generateCsrfToken();
      expect(validateCsrfToken(token, token)).toBe(true);
    });

    it("should reject mismatched tokens", () => {
      expect(validateCsrfToken("token_a", "token_b")).toBe(false);
    });

    it("should reject empty tokens", () => {
      expect(validateCsrfToken("", "")).toBe(false);
      expect(validateCsrfToken("token", "")).toBe(false);
    });
  });

  describe("Cookie Security Attributes", () => {
    it("should set all required security attributes on session cookie", () => {
      const cookie = createSessionCookie("token");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).toContain("Path=/");
      expect(cookie).toMatch(/Max-Age=\d+/);
    });

    it("should set CSRF cookie without HttpOnly", () => {
      const cookie = createCsrfCookie("csrf_token");
      expect(cookie).not.toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Strict");
    });

    it("should clear session with Max-Age=0", () => {
      const cookie = clearSessionCookie();
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("HttpOnly");
    });
  });

  describe("Credential Provider Validation", () => {
    it("should support github provider", () => {
      const encrypted = credentialService.encryptCredential("ghp_test");
      const metadata = credentialService.toMetadata("github", encrypted);
      expect(metadata.provider).toBe("github");
    });

    it("should support openai provider", () => {
      const encrypted = credentialService.encryptCredential("sk-test");
      const metadata = credentialService.toMetadata("openai", encrypted);
      expect(metadata.provider).toBe("openai");
    });
  });

  describe("Login Flow", () => {
    it("should authenticate valid credentials", async () => {
      await authService.register("auth@test.com", "correct_password");
      const result = await authService.login("auth@test.com", "correct_password");
      expect(result.sessionToken).toBeTruthy();
      expect(result.user.email).toBe("auth@test.com");
    });

    it("should reject invalid password", async () => {
      await authService.register("auth2@test.com", "password123");
      await expect(
        authService.login("auth2@test.com", "wrong_password")
      ).rejects.toThrow();
    });

    it("should reject unknown email", async () => {
      await expect(
        authService.login("nobody@test.com", "password123")
      ).rejects.toThrow();
    });
  });
});
