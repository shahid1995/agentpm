import { describe, it, expect, beforeEach } from "vitest";
import { CredentialService } from "./credential-service";

describe("CredentialService", () => {
  let service: CredentialService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    service = new CredentialService();
  });

  describe("encryptCredential", () => {
    it("should encrypt a credential value", () => {
      const result = service.encryptCredential("ghp_secret123");
      expect(result.ciphertext).not.toBe("ghp_secret123");
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
    });

    it("should produce different ciphertext for same value", () => {
      const result1 = service.encryptCredential("same_value");
      const result2 = service.encryptCredential("same_value");
      expect(result1.ciphertext).not.toBe(result2.ciphertext);
    });
  });

  describe("decryptCredential", () => {
    it("should decrypt back to original value", () => {
      const original = "sk-openai-1234567890";
      const encrypted = service.encryptCredential(original);
      const decrypted = service.decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });
  });

  describe("credential metadata", () => {
    it("should return safe metadata without value", () => {
      const encrypted = service.encryptCredential("secret");
      const metadata = service.toMetadata("github", encrypted);
      expect(metadata.provider).toBe("github");
      expect(metadata.keyVersion).toBe("v1");
      expect(metadata).not.toHaveProperty("value");
      expect(metadata).not.toHaveProperty("ciphertext");
    });
  });
});
