import { describe, it, expect, beforeEach } from "vitest";
import { initDb, getDb } from "../../lib/db/index";
import { createUser, createProject, createProjectMember } from "../../lib/db/repositories";

describe("AuthorizationService", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await initDb();
    // Clear tables for fresh test state
    const db = getDb();
    await db.execute("DELETE FROM project_members;");
    await db.execute("DELETE FROM projects;");
    await db.execute("DELETE FROM sessions;");
    await db.execute("DELETE FROM encrypted_credentials;");
    await db.execute("DELETE FROM users;");

    const user = await createUser(`authz-${Date.now()}@test.com`, "hashed");
    userId = user.id;
    const project = await createProject("Test Project", null, userId);
    projectId = project.id;
    await createProjectMember(projectId, userId, "owner");
  });

  describe("checkProjectMembership", () => {
    it("should return true for project owner", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      const result = await service.checkProjectMembership(userId, projectId);
      expect(result.isMember).toBe(true);
      expect(result.role).toBe("owner");
    });

    it("should return false for non-member", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      const otherUser = await createUser(`other-${Date.now()}@test.com`, "hashed");
      const result = await service.checkProjectMembership(otherUser.id, projectId);
      expect(result.isMember).toBe(false);
    });
  });

  describe("resolveProjectRole", () => {
    it("should resolve owner role from database", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      const role = await service.resolveProjectRole(userId, projectId);
      expect(role).toBe("owner");
    });

    it("should return null for non-member", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      const otherUser = await createUser(`nonmember-${Date.now()}@test.com`, "hashed");
      const role = await service.resolveProjectRole(otherUser.id, projectId);
      expect(role).toBeNull();
    });
  });

  describe("projectExists", () => {
    it("should return true for existing project", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      const exists = await service.projectExists(projectId);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent project", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      const exists = await service.projectExists("nonexistent-id");
      expect(exists).toBe(false);
    });
  });

  describe("role-based access control", () => {
    it("should allow owner to modify project", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      expect(service.canModifyProject("owner")).toBe(true);
      expect(service.canModifyProject("member")).toBe(false);
    });

    it("should allow owner to delete project", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      expect(service.canDeleteProject("owner")).toBe(true);
      expect(service.canDeleteProject("member")).toBe(false);
    });

    it("should allow both roles to access project", async () => {
      const { AuthorizationService } = await import("./authorization-service");
      const service = new AuthorizationService();
      expect(service.canAccessProject("owner")).toBe(true);
      expect(service.canAccessProject("member")).toBe(true);
      expect(service.canAccessProject(null)).toBe(false);
    });
  });
});
