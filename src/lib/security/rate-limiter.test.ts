import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRateLimiter } from "./rate-limiter";

describe("InMemoryRateLimiter", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      windowMs: 60000,
      maxRequests: 5,
    });
  });

  describe("basic limiting", () => {
    it("should allow requests within limit", () => {
      const result = limiter.check("user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should track multiple requests", () => {
      for (let i = 0; i < 3; i++) {
        limiter.check("user1");
      }
      const result = limiter.check("user1");
      expect(result.remaining).toBe(1);
    });

    it("should block requests exceeding limit", () => {
      for (let i = 0; i < 5; i++) {
        limiter.check("user1");
      }
      const result = limiter.check("user1");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should track keys independently", () => {
      for (let i = 0; i < 5; i++) {
        limiter.check("user1");
      }
      const result = limiter.check("user2");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe("window expiration", () => {
    it("should reset after window expires", async () => {
      const shortLimiter = new InMemoryRateLimiter({
        windowMs: 50,
        maxRequests: 1,
      });

      shortLimiter.check("user1");
      const blocked = shortLimiter.check("user1");
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 60));

      const result = shortLimiter.check("user1");
      expect(result.allowed).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset specific key", () => {
      for (let i = 0; i < 5; i++) {
        limiter.check("user1");
      }
      limiter.reset("user1");
      const result = limiter.check("user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });
});
