export interface MembershipCheckResult {
  isMember: boolean;
  role: "owner" | "member" | null;
}

export class AuthorizationService {
  /**
   * Check if a user is a member of a project.
   * In production, this queries ProjectMember table.
   */
  checkProjectMembership(
    userId: string,
    projectId: string,
    role: "owner" | "member" | null
  ): MembershipCheckResult {
    if (role === null) {
      return { isMember: false, role: null };
    }
    return { isMember: true, role };
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
