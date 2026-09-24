import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import path from "path";
import fs from "fs";

let client: PGlite | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getPgPath(): string {
  const pgDir = path.join(process.cwd(), ".agentpm", "pgdata");
  if (!fs.existsSync(pgDir)) {
    fs.mkdirSync(pgDir, { recursive: true });
  }
  return pgDir;
}

function getClient() {
  if (!client) {
    // Use in-memory for tests, file-based for persistence
    const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;
    client = isTest ? new PGlite() : new PGlite(getPgPath());
  }
  return client;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getClient());
  }
  return dbInstance;
}

export async function initDb(): Promise<void> {
  const db = getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      metadata JSONB
    );
  `);

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(session_token_hash);`
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS encrypted_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      key_version TEXT NOT NULL DEFAULT 'v1',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );
  `);

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON encrypted_credentials(user_id);`
  );

  // Create projects table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Create project_members table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS project_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);`
  );
}

export { getDb as db };
