import { EncryptionService } from "../security/encryption";
import {
  saveEncryptedCredential,
  getEncryptedCredentials,
  getEncryptedCredentialById,
  getEncryptedCredentialByProvider,
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

    const result = await saveEncryptedCredential(
      userId,
      provider,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag
    );

    return {
      id: result.id,
      provider,
      keyVersion: "v1",
      createdAt: result.createdAt,
    };
  }

  /**
   * Get all credentials for a user (metadata only, no values).
   */
  async getCredentials(userId: string): Promise<CredentialMetadata[]> {
    const creds = await getEncryptedCredentials(userId);
    return creds.map((c) => ({
      ...c,
      provider: c.provider as "github" | "openai",
    }));
  }

  /**
   * Get a decrypted credential by provider.
   */
  async getDecryptedCredential(
    userId: string,
    provider: "github" | "openai"
  ): Promise<string | null> {
    const encrypted = await getEncryptedCredentialByProvider(userId, provider);
    if (!encrypted) return null;
    return this.decryptCredential(encrypted);
  }

  /**
   * Delete a credential. Returns false when no matching credential
   * exists for this user (id nonexistent or owned by another user).
   */
  async deleteCredential(credentialId: string, userId: string): Promise<boolean> {
    const existing = await getEncryptedCredentialById(credentialId, userId);
    if (!existing) return false;
    await deleteEncryptedCredential(credentialId, userId);
    return true;
  }
}
