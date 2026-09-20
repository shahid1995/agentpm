import { desc, eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  users,
  sessions,
  encryptedCredentials,
  projects,
  projectMembers,
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
): Promise<{ id: string; createdAt: Date }> {
  const db = getDb();
  const [cred] = await db
    .insert(encryptedCredentials)
    .values({
      userId,
      provider: provider as "github" | "openai",
      ciphertext,
      iv,
      authTag,
    })
    .returning({ id: encryptedCredentials.id, createdAt: encryptedCredentials.createdAt });
  return cred;
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

export async function getEncryptedCredentialById(
  credentialId: string,
  userId: string
): Promise<{ ciphertext: string; iv: string; authTag: string } | null> {
  const db = getDb();
  const [cred] = await db
    .select({
      ciphertext: encryptedCredentials.ciphertext,
      iv: encryptedCredentials.iv,
      authTag: encryptedCredentials.authTag,
    })
    .from(encryptedCredentials)
    .where(and(eq(encryptedCredentials.id, credentialId), eq(encryptedCredentials.userId, userId)))
    .limit(1);
  return cred || null;
}

export async function getEncryptedCredentialByProvider(
  userId: string,
  provider: string
): Promise<{ ciphertext: string; iv: string; authTag: string } | null> {
  const db = getDb();
  const [cred] = await db
    .select({
      ciphertext: encryptedCredentials.ciphertext,
      iv: encryptedCredentials.iv,
      authTag: encryptedCredentials.authTag,
    })
    .from(encryptedCredentials)
    .where(and(eq(encryptedCredentials.userId, userId), eq(encryptedCredentials.provider, provider as "github" | "openai")))
    .limit(1);
  return cred || null;
}

export async function deleteEncryptedCredential(
  credentialId: string,
  userId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(encryptedCredentials)
    .where(and(eq(encryptedCredentials.id, credentialId), eq(encryptedCredentials.userId, userId)));
}

// Project repository functions
export async function createProject(
  name: string,
  description: string | null,
  ownerId: string
): Promise<{ id: string; name: string; ownerId: string }> {
  const db = getDb();
  const [project] = await db
    .insert(projects)
    .values({ name, description, ownerId })
    .returning({ id: projects.id, name: projects.name, ownerId: projects.ownerId });
  return project;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findProjectById(id: string): Promise<{
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
} | null> {
  if (!UUID_REGEX.test(id)) return null;
  const db = getDb();
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      ownerId: projects.ownerId,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return project || null;
}

export async function createProjectMember(
  projectId: string,
  userId: string,
  role: "owner" | "member"
): Promise<void> {
  const db = getDb();
  await db.insert(projectMembers).values({ projectId, userId, role });
}

export async function findProjectMember(
  projectId: string,
  userId: string
): Promise<{ id: string; role: "owner" | "member" } | null> {
  if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(userId)) return null;
  const db = getDb();
  const [member] = await db
    .select({ id: projectMembers.id, role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return member || null;
}

export async function findProjectsByUserId(userId: string): Promise<
  Array<{ id: string; name: string; role: "owner" | "member" }>
> {
  const db = getDb();
  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));
  return results;
}
