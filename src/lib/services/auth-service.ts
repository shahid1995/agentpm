import { hashPassword, verifyPassword, generateToken, hashToken, generateSessionId, calculateSessionExpiry, isSessionExpired } from "../security/auth";
import {
  createUser,
  findUserByEmail,
  findUserById,
  createSession,
  findSessionByTokenHash,
  revokeSession,
  revokeAllUserSessions,
} from "../db/repositories";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  sessionToken: string;
}

export interface ResolvedSession {
  userId: string;
  email: string;
  sessionId: string;
}

export class AuthService {
  /**
   * Register a new user.
   */
  async register(email: string, password: string): Promise<AuthResult> {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new Error("Email already registered");
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);

    const sessionToken = generateToken();
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = calculateSessionExpiry();

    await createSession(user.id, sessionTokenHash, expiresAt);

    return {
      user: { id: user.id, email: user.email },
      sessionToken,
    };
  }

  /**
   * Login with email and password.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await findUserByEmail(email);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    const sessionToken = generateToken();
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = calculateSessionExpiry();

    await createSession(user.id, sessionTokenHash, expiresAt);

    return {
      user: { id: user.id, email: user.email },
      sessionToken,
    };
  }

  /**
   * Logout by revoking session.
   */
  async logout(sessionToken: string): Promise<void> {
    const tokenHash = hashToken(sessionToken);
    const session = await findSessionByTokenHash(tokenHash);

    if (session && !session.revokedAt) {
      await revokeSession(session.id);
    }
  }

  /**
   * Resolve session from token.
   */
  async resolveSession(sessionToken: string): Promise<ResolvedSession | null> {
    const tokenHash = hashToken(sessionToken);
    const session = await findSessionByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    if (session.revokedAt) {
      return null;
    }

    if (isSessionExpired(session.expiresAt)) {
      return null;
    }

    const user = await findUserById(session.userId);
    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      sessionId: session.id,
    };
  }

  /**
   * Revoke all sessions for a user.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await revokeAllUserSessions(userId);
  }

  /**
   * Get user by ID.
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    const user = await findUserById(userId);
    if (!user) return null;
    return { id: user.id, email: user.email };
  }
}
