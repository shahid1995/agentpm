import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/lib/db/index";
import { createUser, findUserById, findUserByEmail, createSession, findSessionByTokenHash, revokeSession } from "@/lib/db/repositories";

describe("PostgreSQL Persistence (PGlite)", () => {
  let db: Awaited<ReturnType<typeof initDb>>;

  beforeEach(async () => {
    db = await initDb();
  });

  describe("User persistence", () => {
    it("should create user in PostgreSQL", async () => {
      const user = await createUser("pgtest@example.com", "hashed_password");
      expect(user.id).toBeTruthy();
      expect(user.email).toBe("pgtest@example.com");

      const found = await findUserByEmail("pgtest@example.com");
      expect(found).toBeTruthy();
      expect(found?.email).toBe("pgtest@example.com");
    });

    it("should find user by ID", async () => {
      const user = await createUser("byid@example.com", "hash");
      const found = await findUserById(user.id);
      expect(found).toBeTruthy();
      expect(found?.id).toBe(user.id);
    });
  });

  describe("Session persistence", () => {
    it("should create session in PostgreSQL", async () => {
      const user = await createUser("session@example.com", "hash");
      const session = await createSession(user.id, "token_hash_123", new Date(Date.now() + 86400000));
      expect(session.id).toBeTruthy();

      const found = await findSessionByTokenHash("token_hash_123");
      expect(found).toBeTruthy();
      expect(found?.userId).toBe(user.id);
    });

    it("should revoke session", async () => {
      const user = await createUser("revoke@example.com", "hash");
      const session = await createSession(user.id, "revoke_token", new Date(Date.now() + 86400000));

      await revokeSession(session.id);

      const found = await findSessionByTokenHash("revoke_token");
      expect(found?.revokedAt).toBeTruthy();
    });
  });
});
