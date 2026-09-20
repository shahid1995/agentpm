import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the repository layer for unit tests
vi.mock("../db/repositories", () => ({
  createUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@test.com" }),
  findUserByEmail: vi.fn().mockResolvedValue(null),
  findUserById: vi.fn().mockResolvedValue({ id: "user-1", email: "test@test.com" }),
  createSession: vi.fn().mockResolvedValue({ id: "session-1" }),
  findSessionByTokenHash: vi.fn().mockResolvedValue(null),
  revokeSession: vi.fn().mockResolvedValue(undefined),
  revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
  updateSessionLastSeen: vi.fn().mockResolvedValue(undefined),
  saveEncryptedCredential: vi.fn().mockResolvedValue(undefined),
  getEncryptedCredentials: vi.fn().mockResolvedValue([]),
  deleteEncryptedCredential: vi.fn().mockResolvedValue(undefined),
}));

import { AuthService } from "./auth-service";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("should register a new user with hashed password", async () => {
      const { findUserByEmail, createUser, createSession } = await import("../db/repositories");
      (findUserByEmail as any).mockResolvedValueOnce(null);
      (createUser as any).mockResolvedValueOnce({ id: "user-1", email: "user@example.com" });
      (createSession as any).mockResolvedValueOnce({ id: "session-1" });

      const result = await service.register("user@example.com", "password123");
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe("user@example.com");
      expect(result.sessionToken).toBeTruthy();
    });

    it("should reject duplicate email", async () => {
      const { findUserByEmail } = await import("../db/repositories");
      (findUserByEmail as any).mockResolvedValueOnce({ id: "existing", email: "duplicate@example.com" });

      await expect(
        service.register("duplicate@example.com", "password123")
      ).rejects.toThrow();
    });
  });

  describe("login", () => {
    it("should authenticate with correct credentials", async () => {
      const { findUserByEmail, createSession } = await import("../db/repositories");
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("password123", 12);
      (findUserByEmail as any).mockResolvedValueOnce({ id: "user-1", email: "login@example.com", passwordHash: hash });
      (createSession as any).mockResolvedValueOnce({ id: "session-1" });

      const result = await service.login("login@example.com", "password123");
      expect(result.sessionToken).toBeTruthy();
    });

    it("should reject incorrect password", async () => {
      const { findUserByEmail } = await import("../db/repositories");
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("password123", 12);
      (findUserByEmail as any).mockResolvedValueOnce({ id: "user-1", email: "login2@example.com", passwordHash: hash });

      await expect(
        service.login("login2@example.com", "wrongpassword")
      ).rejects.toThrow();
    });

    it("should reject unknown email", async () => {
      const { findUserByEmail } = await import("../db/repositories");
      (findUserByEmail as any).mockResolvedValueOnce(null);

      await expect(
        service.login("unknown@example.com", "password123")
      ).rejects.toThrow();
    });
  });

  describe("logout", () => {
    it("should revoke session on logout", async () => {
      const { findSessionByTokenHash, revokeSession } = await import("../db/repositories");
      (findSessionByTokenHash as any).mockResolvedValueOnce({ id: "session-1" });
      (revokeSession as any).mockResolvedValueOnce(undefined);

      await service.logout("valid_token");
      expect(revokeSession).toHaveBeenCalled();
    });
  });

  describe("resolveSession", () => {
    it("should resolve valid session", async () => {
      const { findSessionByTokenHash, findUserById } = await import("../db/repositories");
      (findSessionByTokenHash as any).mockResolvedValueOnce({
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 86400000),
      });
      (findUserById as any).mockResolvedValueOnce({ id: "user-1", email: "session@example.com" });

      const session = await service.resolveSession("valid_token");
      expect(session).toBeDefined();
      expect(session?.email).toBe("session@example.com");
    });

    it("should return null for invalid token", async () => {
      const { findSessionByTokenHash } = await import("../db/repositories");
      (findSessionByTokenHash as any).mockResolvedValueOnce(null);

      const session = await service.resolveSession("invalid_token");
      expect(session).toBeNull();
    });

    it("should return null for revoked session", async () => {
      const { findSessionByTokenHash } = await import("../db/repositories");
      (findSessionByTokenHash as any).mockResolvedValueOnce({
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
      });

      const session = await service.resolveSession("revoked_token");
      expect(session).toBeNull();
    });

    it("should return null for expired session", async () => {
      const { findSessionByTokenHash } = await import("../db/repositories");
      (findSessionByTokenHash as any).mockResolvedValueOnce({
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      });

      const session = await service.resolveSession("expired_token");
      expect(session).toBeNull();
    });
  });
});
