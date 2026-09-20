import { describe, it, expect } from "vitest";
import { extractSessionToken } from "./cookies";

describe("extractSessionToken", () => {
  it("should extract token from cookie header", () => {
    const token = extractSessionToken("agentpm_session=abc123; other=value");
    expect(token).toBe("abc123");
  });

  it("should return null for empty header", () => {
    expect(extractSessionToken(null)).toBeNull();
    expect(extractSessionToken(undefined)).toBeNull();
    expect(extractSessionToken("")).toBeNull();
  });

  it("should return null if session cookie not present", () => {
    const token = extractSessionToken("other=value; another=test");
    expect(token).toBeNull();
  });
});
