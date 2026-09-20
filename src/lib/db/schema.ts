import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

// Enums
export const projectRoleEnum = pgEnum("project_role", ["owner", "member"]);
export const workItemStatusEnum = pgEnum("work_item_status", [
  "idea",
  "planning",
  "ready",
  "executing",
  "verification",
  "done",
]);
export const specificationStatusEnum = pgEnum("specification_status", [
  "draft",
  "review",
  "approved",
  "superseded",
]);
export const executionStatusEnum = pgEnum("execution_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "not_started",
  "running",
  "passed",
  "failed",
  "blocked",
]);
export const evidenceTypeEnum = pgEnum("evidence_type", [
  "test_result",
  "build_result",
  "lint_result",
  "screenshot",
  "commit",
  "pull_request",
  "review",
  "log",
  "manual",
]);
export const providerEnum = pgEnum("provider", ["github", "openai"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Sessions table
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionTokenHash: text("session_token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
});

// Projects table
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Project members table
export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: projectRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

// Repositories table
export const repositories = pgTable("repositories", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("github"),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  credentialId: uuid("credential_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Work items table
export const workItems = pgTable("work_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  repositoryId: uuid("repository_id").references(() => repositories.id, { onDelete: "set null" }),
  githubIssueId: text("github_issue_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: workItemStatusEnum("status").notNull().default("idea"),
  priority: integer("priority"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Context boundaries table
export const contextBoundaries = pgTable("context_boundaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  repositoryId: uuid("repository_id").references(() => repositories.id, { onDelete: "set null" }),
  branch: text("branch"),
  paths: text("paths").array().notNull().default([]),
  files: text("files").array().notNull().default([]),
  exclusions: text("exclusions").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Specifications table
export const specifications = pgTable("specifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  status: specificationStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Agent prompts table
export const agentPrompts = pgTable("agent_prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  generatedBy: text("generated_by").notNull().default("user"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Executions table
export const executions = pgTable("executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  agentType: text("agent_type"),
  status: executionStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Verifications table
export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  executionId: uuid("execution_id")
    .notNull()
    .references(() => executions.id, { onDelete: "cascade" }),
  status: verificationStatusEnum("status").notNull().default("not_started"),
  verifier: text("verifier"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Evidence table
export const evidence = pgTable("evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  verificationId: uuid("verification_id")
    .notNull()
    .references(() => verifications.id, { onDelete: "cascade" }),
  type: evidenceTypeEnum("type").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Encrypted credentials table
export const encryptedCredentials = pgTable("encrypted_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  keyVersion: text("key_version").notNull().default("v1"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
