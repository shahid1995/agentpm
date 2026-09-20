import { describe, it, expect, beforeEach } from "vitest";
import { AuthorizationService } from "./authorization-service";

describe("AuthorizationService", () => {
  let service: AuthorizationService;

  beforeEach(() => {
    service = new AuthorizationService();
  });

  describe("checkProjectMembership", () => {
    it("should return true for project owner", () => {
      const result = service.checkProjectMembership("user1", "project1", "owner");
      expect(result.isMember).toBe(true);
      expect(result.role).toBe("owner");
    });

    it("should return true for project member", () => {
      const result = service.checkProjectMembership("user1", "project1", "member");
      expect(result.isMember).toBe(true);
      expect(result.role).toBe("member");
    });

    it("should return false for non-member", () => {
      const result = service.checkProjectMembership("user1", "project1", null);
      expect(result.isMember).toBe(false);
    });
  });

  describe("canAccessProject", () => {
    it("should allow owner access", () => {
      expect(service.canAccessProject("owner")).toBe(true);
    });

    it("should allow member access", () => {
      expect(service.canAccessProject("member")).toBe(true);
    });

    it("should deny non-member access", () => {
      expect(service.canAccessProject(null)).toBe(false);
    });
  });

  describe("canModifyProject", () => {
    it("should allow owner modification", () => {
      expect(service.canModifyProject("owner")).toBe(true);
    });

    it("should deny member modification", () => {
      expect(service.canModifyProject("member")).toBe(false);
    });
  });

  describe("canDeleteProject", () => {
    it("should allow owner deletion", () => {
      expect(service.canDeleteProject("owner")).toBe(true);
    });

    it("should deny non-owner deletion", () => {
      expect(service.canDeleteProject("member")).toBe(false);
    });
  });
});
