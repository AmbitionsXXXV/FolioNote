import { authClient } from "@/lib/auth-client"
import { getServerUrl } from "@/utils/api-environment"

/** Must match DRIVE_FILE_SCOPE in packages/api/src/connectors/google-docs.ts. */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

export type ImportSourceKind = "notion" | "google_docs" | "claude_page" | "web"

export const IMPORT_SOURCE_KINDS: ImportSourceKind[] = [
  "notion",
  "google_docs",
  "claude_page",
  "web"
]

export type ImportProvider =
  | "notion"
  | "google_docs"
  | "claude_page"
  | "web"
  | "markdown"

/**
 * Top-level navigation to the server, which redirects to Notion's page
 * picker and back to `returnTo`. Re-running it is how users edit page access.
 */
export function notionConnectUrl(returnTo: string): string {
  return `${getServerUrl()}/api/connections/notion/start?returnTo=${encodeURIComponent(returnTo)}`
}

/**
 * One extra consent on the user's existing Google sign-in. Better Auth sends
 * include_granted_scopes, so email/profile stay granted alongside drive.file.
 */
export async function requestGoogleDocsAccess(
  callbackURL: string
): Promise<void> {
  const { error } = await authClient.linkSocial({
    provider: "google",
    scopes: [DRIVE_FILE_SCOPE],
    callbackURL
  })
  if (error) {
    throw new Error(error.message ?? "Google sign-in failed")
  }
}

/** `PRECONDITION_FAILED` + data.reason from the imports router. */
export function importErrorReason(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return null
  }
  const { data } = error as { data?: { reason?: unknown } }
  return typeof data?.reason === "string" ? data.reason : null
}
