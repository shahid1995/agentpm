import crypto from "crypto";

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class EncryptionService {
  private key: Buffer;

  constructor() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    if (keyHex.length !== 64) {
      throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
    }
    this.key = Buffer.from(keyHex, "hex");
  }

  encrypt(plaintext: string): EncryptedData {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);

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
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(encrypted.iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));

    let plaintext = decipher.update(encrypted.ciphertext, "hex", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
  }
}
