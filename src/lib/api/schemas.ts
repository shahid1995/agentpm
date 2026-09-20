import { z } from "zod";

// User schemas
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
});

// Work item schemas
export const createWorkItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  repositoryId: z.string().uuid().optional(),
  githubIssueId: z.string().max(50).optional(),
});

export const updateWorkItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  status: z.enum(["idea", "planning", "ready", "executing", "verification", "done"]).optional(),
});

// Repository schemas
export const createRepositorySchema = z.object({
  provider: z.string().max(50).default("github"),
  owner: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-]+$/, "Invalid owner format"),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, "Invalid repo name"),
  defaultBranch: z.string().max(100).default("main"),
});

// Credential schemas
export const storeCredentialSchema = z.object({
  provider: z.enum(["github", "openai"]),
  value: z.string().min(1).max(2048),
});

export const deleteCredentialSchema = z.object({
  credentialId: z.string().uuid(),
});

export const getCredentialSchema = z.object({
  credentialId: z.string().uuid(),
});

// Context boundary schemas
export const createContextBoundarySchema = z.object({
  workItemId: z.string().uuid(),
  repositoryId: z.string().uuid().optional(),
  branch: z.string().max(100).optional(),
  paths: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
});

// Specification schemas
export const createSpecificationSchema = z.object({
  workItemId: z.string().uuid(),
  content: z.string().min(1).max(50000),
});

// Agent prompt schemas
export const createAgentPromptSchema = z.object({
  workItemId: z.string().uuid(),
  content: z.string().min(1).max(50000),
  generatedBy: z.enum(["user", "ai"]).default("user"),
});

// Execution schemas
export const createExecutionSchema = z.object({
  workItemId: z.string().uuid(),
  agentType: z.string().max(100).optional(),
});

// Verification schemas
export const createVerificationSchema = z.object({
  executionId: z.string().uuid(),
  verifier: z.string().max(100).optional(),
});

// Evidence schemas
export const createEvidenceSchema = z.object({
  verificationId: z.string().uuid(),
  type: z.enum([
    "test_result",
    "build_result",
    "lint_result",
    "screenshot",
    "commit",
    "pull_request",
    "review",
    "log",
    "manual",
  ]),
  description: z.string().min(1).max(500),
  reference: z.string().max(500).optional(),
});
