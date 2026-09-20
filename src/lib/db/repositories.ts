import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  users,
  sessions,
  encryptedCredentials,
} from "../db/schema";

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
  lastSeenAt?: Date | null;
  revokedAt?: Date | null;
  metadata?: unknown;
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning();
  return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user || null;
}

export async function createSession(
  userId: string,
  sessionTokenHash: string,
  expiresAt: Date
): Promise<Session> {
  const db = getDb();
  const [session] = await db
    .insert(sessions)
    .values({ userId, sessionTokenHash, expiresAt })
    .returning();
  return session;
}

export async function findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionTokenHash, tokenHash))
    .limit(1);
  return session || null;
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.userId, userId));
}

export async function updateSessionLastSeen(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function saveEncryptedCredential(
  userId: string,
  provider: string,
  ciphertext: string,
  iv: string,
  authTag: string
): Promise<void> {
  const db = getDb();
  await db.insert(encryptedCredentials).values({
    userId,
    provider: provider as "github" | "openai",
    ciphertext,
    iv,
    authTag,
  });
}

export async function getEncryptedCredentials(userId: string): Promise<
  Array<{ id: string; provider: string; keyVersion: string; createdAt: Date }>
> {
  const db = getDb();
  const creds = await db
    .select({
      id: encryptedCredentials.id,
      provider: encryptedCredentials.provider,
      keyVersion: encryptedCredentials.keyVersion,
      createdAt: encryptedCredentials.createdAt,
    })
    .from(encryptedCredentials)
    .where(eq(encryptedCredentials.userId, userId))
    .orderBy(desc(encryptedCredentials.createdAt));
  return creds;
}

export async function deleteEncryptedCredential(
  credentialId: string,
  userId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(encryptedCredentials)
    .where(eq(encryptedCredentials.id, credentialId));
}
