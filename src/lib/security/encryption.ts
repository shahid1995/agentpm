import crypto from "crypto";

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class EncryptionService {
  private key: Buffer | null = null;

  /**
   * Get or initialize the encryption key.
   * Deferred to first use to avoid build-time errors.
   */
  private getKey(): Buffer {
    if (this.key) return this.key;

    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    if (keyHex.length !== 64) {
      throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
    }
    this.key = Buffer.from(keyHex, "hex");
    return this.key;
  }

  encrypt(plaintext: string): EncryptedData {
    const key = this.getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  decrypt(encrypted: EncryptedData): string {
    const key = this.getKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(encrypted.iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));

    let plaintext = decipher.update(encrypted.ciphertext, "hex", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
  }
}
