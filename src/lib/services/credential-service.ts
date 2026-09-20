import { EncryptionService, EncryptedData } from "../security/encryption";

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface CredentialMetadata {
  provider: "github" | "openai";
  keyVersion: string;
}

export class CredentialService {
  private encryption: EncryptionService;

  constructor() {
    this.encryption = new EncryptionService();
  }

  /**
   * Encrypt a credential value for storage.
   */
  encryptCredential(value: string): EncryptedCredential {
    return this.encryption.encrypt(value);
  }

  /**
   * Decrypt a stored credential.
   */
  decryptCredential(encrypted: EncryptedCredential): string {
    return this.encryption.decrypt(encrypted);
  }

  /**
   * Convert encrypted credential to safe metadata (no value).
   */
  toMetadata(provider: "github" | "openai", encrypted: EncryptedCredential): CredentialMetadata {
    return {
      provider,
      keyVersion: "v1",
    };
  }
}
