import { describe, it, expect, beforeEach } from "vitest";
import { EncryptionService } from "./encryption";

describe("EncryptionService", () => {
  let service: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64); // 32 bytes hex
    service = new EncryptionService();
  });

  describe("encrypt/decrypt round-trip", () => {
    it("should decrypt encrypted text back to original", () => {
      const plaintext = "ghp_test1234567890abcdef";
      const encrypted = service.encrypt(plaintext);

      expect(encrypted.ciphertext).not.toBe(plaintext);
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext", () => {
      const plaintext = "sk-test1234567890";
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it("should handle empty strings", () => {
      const encrypted = service.encrypt("");
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe("");
    });
  });

  describe("key validation", () => {
    it("should throw if ENCRYPTION_KEY is missing on encrypt", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => service.encrypt("test")).toThrow("ENCRYPTION_KEY");
    });

    it("should throw if ENCRYPTION_KEY is wrong length on encrypt", () => {
      process.env.ENCRYPTION_KEY = "tooshort";
      expect(() => service.encrypt("test")).toThrow("32 bytes");
    });
  });

  describe("decryption failures", () => {
    it("should throw on tampered ciphertext", () => {
      const encrypted = service.encrypt("secret");
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.replace(/[0-9a-f]/, "x"),
      };

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it("should throw on wrong IV", () => {
      const encrypted = service.encrypt("secret");
      const wrongIv = {
        ...encrypted,
        iv: encrypted.iv.replace(/[0-9a-f]/, "x"),
      };

      expect(() => service.decrypt(wrongIv)).toThrow();
    });
  });
});
