import { EncryptionService } from "../security/encryption";
import {
  saveEncryptedCredential,
  getEncryptedCredentials,
  deleteEncryptedCredential,
} from "../db/repositories";

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface CredentialMetadata {
  id: string;
  provider: "github" | "openai";
  keyVersion: string;
  createdAt: Date;
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
  toMetadata(provider: "github" | "openai", encrypted: EncryptedCredential): { provider: string; keyVersion: string } {
    return {
      provider,
      keyVersion: "v1",
    };
  }

  /**
   * Store encrypted credential in PostgreSQL.
   */
  async storeCredential(
    userId: string,
    provider: "github" | "openai",
    value: string
  ): Promise<CredentialMetadata> {
    const encrypted = this.encryptCredential(value);

    await saveEncryptedCredential(
      userId,
      provider,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag
    );

    return {
      id: "", // Would be returned from DB
      provider,
      keyVersion: "v1",
      createdAt: new Date(),
    };
  }

  /**
   * Get all credentials for a user (metadata only, no values).
   */
  async getCredentials(userId: string): Promise<CredentialMetadata[]> {
    return getEncryptedCredentials(userId);
  }

  /**
   * Delete a credential.
   */
  async deleteCredential(credentialId: string, userId: string): Promise<void> {
    await deleteEncryptedCredential(credentialId, userId);
  }
}
