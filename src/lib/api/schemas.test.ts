import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  createProjectSchema,
  updateProjectSchema,
  createWorkItemSchema,
  updateWorkItemSchema,
  createRepositorySchema,
  storeCredentialSchema,
} from "./schemas";

describe("Validation Schemas", () => {
  describe("registerSchema", () => {
    it("should accept valid registration", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = registerSchema.safeParse({
        email: "invalid-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject short password", () => {
      const result = registerSchema.safeParse({
        email: "user@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing fields", () => {
      const result = registerSchema.safeParse({ email: "user@example.com" });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept valid credentials", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createProjectSchema", () => {
    it("should accept valid project", () => {
      const result = createProjectSchema.safeParse({
        name: "My Project",
        description: "A project",
      });
      expect(result.success).toBe(true);
    });

    it("should accept project without description", () => {
      const result = createProjectSchema.safeParse({ name: "Project" });
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = createProjectSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("should reject name exceeding 100 chars", () => {
      const result = createProjectSchema.safeParse({ name: "a".repeat(101) });
      expect(result.success).toBe(false);
    });
  });

  describe("createWorkItemSchema", () => {
    it("should accept valid work item", () => {
      const result = createWorkItemSchema.safeParse({
        title: "Fix login bug",
        description: "Button not working",
        priority: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty title", () => {
      const result = createWorkItemSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid priority", () => {
      const result = createWorkItemSchema.safeParse({
        title: "Task",
        priority: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createRepositorySchema", () => {
    it("should accept valid repo", () => {
      const result = createRepositorySchema.safeParse({
        owner: "shahid1995",
        name: "options-dashboard",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid owner format", () => {
      const result = createRepositorySchema.safeParse({
        owner: "invalid owner!",
        name: "repo",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("storeCredentialSchema", () => {
    it("should accept valid credential", () => {
      const result = storeCredentialSchema.safeParse({
        provider: "github",
        value: "ghp_1234567890abcdef",
      });
      expect(result.success).toBe(true);
    });

    it("should reject unsupported provider", () => {
      const result = storeCredentialSchema.safeParse({
        provider: "unsupported",
        value: "secret",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty value", () => {
      const result = storeCredentialSchema.safeParse({
        provider: "github",
        value: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject value exceeding max length", () => {
      const result = storeCredentialSchema.safeParse({
        provider: "github",
        value: "a".repeat(2049),
      });
      expect(result.success).toBe(false);
    });
  });
});
