import { hashPassword, verifyPassword, generateToken, hashToken, generateSessionId, calculateSessionExpiry, isSessionExpired } from "../security/auth";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  sessionTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt?: Date;
  revokedAt?: Date;
}

export interface AuthResult {
  user: User;
  sessionToken: string;
}

interface UserStore {
  users: Map<string, User>;
  sessions: Map<string, Session>;
}

// In-memory store for development/testing
// In production, this would be PostgreSQL via Drizzle
const store: UserStore = {
  users: new Map(),
  sessions: new Map(),
};

export class AuthService {
  /**
   * Register a new user.
   */
  async register(email: string, password: string): Promise<AuthResult> {
    // Check for existing user
    const existingUser = Array.from(store.users.values()).find((u) => u.email === email);
    if (existingUser) {
      throw new Error("Email already registered");
    }

    const passwordHash = await hashPassword(password);
    const id = generateSessionId();
    const now = new Date();

    const user: User = {
      id,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    store.users.set(id, user);

    const sessionToken = generateToken();
    const session: Session = {
      id: generateSessionId(),
      userId: user.id,
      sessionTokenHash: hashToken(sessionToken),
      createdAt: now,
      expiresAt: calculateSessionExpiry(),
    };

    store.sessions.set(session.id, session);

    return { user, sessionToken };
  }

  /**
   * Login with email and password.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = Array.from(store.users.values()).find((u) => u.email === email);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    const sessionToken = generateToken();
    const now = new Date();

    const session: Session = {
      id: generateSessionId(),
      userId: user.id,
      sessionTokenHash: hashToken(sessionToken),
      createdAt: now,
      expiresAt: calculateSessionExpiry(),
    };

    store.sessions.set(session.id, session);

    return { user, sessionToken };
  }

  /**
   * Logout by revoking session.
   */
  async logout(sessionToken: string): Promise<void> {
    const tokenHash = hashToken(sessionToken);
    for (const [id, session] of store.sessions) {
      if (session.sessionTokenHash === tokenHash) {
        session.revokedAt = new Date();
        store.sessions.set(id, session);
        return;
      }
    }
  }

  /**
   * Resolve session from token.
   */
  async resolveSession(sessionToken: string): Promise<(Session & { user: User }) | null> {
    const tokenHash = hashToken(sessionToken);

    for (const session of store.sessions.values()) {
      if (session.sessionTokenHash === tokenHash) {
        // Check if revoked
        if (session.revokedAt) {
          return null;
        }

        // Check if expired
        if (isSessionExpired(session.expiresAt)) {
          return null;
        }

        const user = store.users.get(session.userId);
        if (!user) {
          return null;
        }

        return { ...session, user };
      }
    }

    return null;
  }

  /**
   * Revoke all sessions for a user.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    for (const [id, session] of store.sessions) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = new Date();
        store.sessions.set(id, session);
      }
    }
  }

  /**
   * Get user by ID.
   */
  async getUserById(userId: string): Promise<User | null> {
    return store.users.get(userId) || null;
  }
}
