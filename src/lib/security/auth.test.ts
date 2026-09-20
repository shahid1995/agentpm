import { describe, it, expect, beforeEach } from "vitest";
import {
  hashToken,
  generateToken,
  generateSessionId,
  hashPassword,
  verifyPassword,
  SESSION_TOKEN_BYTES,
  SESSION_MAX_AGE_MS,
  isSessionExpired,
} from "./auth";

describe("Auth Utilities", () => {
  describe("generateToken", () => {
    it("should generate a token of expected byte length", () => {
      const token = generateToken();
      const buffer = Buffer.from(token, "hex");
      expect(buffer.length).toBe(SESSION_TOKEN_BYTES);
    });

    it("should generate unique tokens", () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("hashToken", () => {
    it("should hash a token deterministically", () => {
      const token = "abc123";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different tokens", () => {
      const hash1 = hashToken("token1");
      const hash2 = hashToken("token2");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce a hex string", () => {
      const hash = hashToken("test");
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("generateSessionId", () => {
    it("should return a UUID v4 format", () => {
      const id = generateSessionId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });
  });

  describe("hashPassword / verifyPassword", () => {
    it("should hash password and verify correct password", async () => {
      const password = "userPassword123!";
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should fail verification for incorrect password", async () => {
      const password = "correctPassword";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword("wrongPassword", hash);
      expect(isValid).toBe(false);
    });

    it("should produce different hashes for same password (salt)", async () => {
      const password = "samePassword";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("isSessionExpired", () => {
    it("should return true for expired session", () => {
      const past = new Date(Date.now() - 1000);
      expect(isSessionExpired(past)).toBe(true);
    });

    it("should return false for valid session", () => {
      const future = new Date(Date.now() + SESSION_MAX_AGE_MS);
      expect(isSessionExpired(future)).toBe(false);
    });
  });
});
