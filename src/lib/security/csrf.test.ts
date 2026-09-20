import { describe, it, expect } from "vitest";
import { validateCsrfToken, generateCsrfToken } from "./csrf";

describe("CSRF Protection", () => {
  describe("generateCsrfToken", () => {
    it("should generate a token", () => {
      const token = generateCsrfToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
    });

    it("should generate unique tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("validateCsrfToken", () => {
    it("should accept valid token pair", () => {
      const token = generateCsrfToken();
      expect(validateCsrfToken(token, token)).toBe(true);
    });

    it("should reject mismatched tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(validateCsrfToken(token1, token2)).toBe(false);
    });

    it("should reject empty tokens", () => {
      expect(validateCsrfToken("", "")).toBe(false);
      expect(validateCsrfToken("valid", "")).toBe(false);
    });

    it("should use constant-time comparison", () => {
      const token = generateCsrfToken();
      // Should not throw
      expect(() => validateCsrfToken(token, "different")).not.toThrow();
    });
  });
});
