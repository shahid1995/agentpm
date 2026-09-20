import { describe, it, expect } from "vitest";
import { createSessionCookie, clearSessionCookie, SESSION_COOKIE_NAME } from "./cookies";

describe("Cookie Utilities", () => {
  describe("createSessionCookie", () => {
    it("should create a Set-Cookie header with HttpOnly", () => {
      const cookie = createSessionCookie("test_token_123");
      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("test_token_123");
    });

    it("should include Secure flag", () => {
      const cookie = createSessionCookie("token");
      expect(cookie).toContain("Secure");
    });

    it("should include SameSite=Strict", () => {
      const cookie = createSessionCookie("token");
      expect(cookie).toContain("SameSite=Strict");
    });

    it("should set Path=/", () => {
      const cookie = createSessionCookie("token");
      expect(cookie).toContain("Path=/");
    });

    it("should set Max-Age", () => {
      const cookie = createSessionCookie("token");
      expect(cookie).toMatch(/Max-Age=\d+/);
    });
  });

  describe("clearSessionCookie", () => {
    it("should create a cookie with Max-Age=0", () => {
      const cookie = clearSessionCookie();
      expect(cookie).toContain("Max-Age=0");
    });

    it("should include HttpOnly", () => {
      const cookie = clearSessionCookie();
      expect(cookie).toContain("HttpOnly");
    });
  });
});
