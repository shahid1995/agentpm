import { findProjectById, findProjectMember } from "../db/repositories";

export interface MembershipCheckResult {
  isMember: boolean;
  role: "owner" | "member" | null;
}

export class AuthorizationService {
  /**
   * Check if a user is a member of a project.
   * Queries persisted ProjectMember table — never trusts client-supplied role.
   */
  async checkProjectMembership(
    userId: string,
    projectId: string
  ): Promise<MembershipCheckResult> {
    const member = await findProjectMember(projectId, userId);
    if (!member) {
      return { isMember: false, role: null };
    }
    return { isMember: true, role: member.role };
  }

  /**
   * Resolve the actual role for a user in a project.
   * Returns null if not a member.
   */
  async resolveProjectRole(
    userId: string,
    projectId: string
  ): Promise<"owner" | "member" | null> {
    const member = await findProjectMember(projectId, userId);
    return member?.role || null;
  }

  /**
   * Check if a project exists.
   */
  async projectExists(projectId: string): Promise<boolean> {
    const project = await findProjectById(projectId);
    return project !== null;
  }

  /**
   * Check if role can access project resources.
   */
  canAccessProject(role: "owner" | "member" | null): boolean {
    return role !== null;
  }

  /**
   * Check if role can modify project settings.
   */
  canModifyProject(role: "owner" | "member" | null): boolean {
    return role === "owner";
  }

  /**
   * Check if role can delete project.
   */
  canDeleteProject(role: "owner" | "member" | null): boolean {
    return role === "owner";
  }

  /**
   * Check if role can create work items.
   */
  canCreateWorkItem(role: "owner" | "member" | null): boolean {
    return role !== null;
  }

  /**
   * Check if role can modify work items.
   */
  canModifyWorkItem(role: "owner" | "member" | null): boolean {
    return role !== null;
  }

  /**
   * Check if role can delete work items.
   */
  canDeleteWorkItem(role: "owner" | "member" | null): boolean {
    return role === "owner";
  }
}
