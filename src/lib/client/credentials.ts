/**
 * Client-side helpers for the server-side credential lifecycle.
 * Credentials are never persisted in browser storage — all operations
 * go through the authenticated /api/credentials boundary.
 */

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("agentpm_csrf="))
      ?.split("=")[1] || ""
  );
}

export interface CredentialMetadataDTO {
  id: string;
  provider: "github" | "openai";
  keyVersion: string;
  createdAt: string;
}

/**
 * List the current user's stored credentials (metadata only).
 * Returns an empty array when none exist.
 */
export async function listCredentials(): Promise<CredentialMetadataDTO[]> {
  const response = await fetch("/api/credentials", { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to list credentials");
  }
  const body = await response.json();
  return body?.data?.credentials ?? [];
}

/**
 * Delete one credential by ID. Returns true when deleted, false when
 * it did not exist (idempotent).
 */
export async function deleteCredential(credentialId: string): Promise<boolean> {
  const response = await fetch("/api/credentials", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCsrfToken(),
    },
    body: JSON.stringify({ credentialId }),
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error("Failed to delete credential");
  }
  return true;
}

/**
 * Delete all of the current user's stored integration credentials
 * (GitHub and OpenAI). Idempotent: succeeds when no credentials exist.
 */
export async function deleteAllCredentials(): Promise<number> {
  const credentials = await listCredentials();
  let deleted = 0;
  for (const credential of credentials) {
    const ok = await deleteCredential(credential.id);
    if (ok) deleted++;
  }
  return deleted;
}
