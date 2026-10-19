/**
 * Google Docs via the user's existing Better Auth Google sign-in.
 *
 * No separate connector: the web client calls
 * `authClient.linkSocial({ provider: "google", scopes: [DRIVE_FILE_SCOPE] })`
 * once; Better Auth sends include_granted_scopes=true and, on relink of the
 * same Google account, updates the existing account row's tokens + scope.
 * `drive.file` only covers files the user opens through the Google Picker,
 * so a pasted doc URL the user never picked is (correctly) a 404 here.
 */
import { auth } from "@folionote/auth"
import { account, db } from "@folionote/db"
import { and, eq } from "drizzle-orm"

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

const DOC_ID_PATTERN = /\/document\/d\/([\w-]{20,})/
const RAW_DOC_ID_PATTERN = /^[\w-]{20,}$/

export class GoogleDocsAccessError extends Error {
  readonly reason: "not_linked" | "scope_missing" | "not_found" | "failed"

  constructor(reason: GoogleDocsAccessError["reason"], message: string) {
    super(message)
    this.name = "GoogleDocsAccessError"
    this.reason = reason
  }
}

export interface GoogleAccessStatus {
  linked: boolean
  hasDocsScope: boolean
}

interface AccessTokenResult {
  accessToken: string
  scopes: string[]
}

async function readGoogleAccessToken(
  userId: string
): Promise<AccessTokenResult | null> {
  try {
    const [googleAccount] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
      .limit(1)
    if (!googleAccount) return null

    const result = await auth.api.getAccessToken({
      body: { accountId: googleAccount.id, userId }
    })
    return { accessToken: result.accessToken, scopes: result.scopes ?? [] }
  } catch {
    // ACCOUNT_NOT_FOUND / PROVIDER_NOT_SUPPORTED both mean "not linked"
    return null
  }
}

export async function getGoogleAccessStatus(
  userId: string
): Promise<GoogleAccessStatus> {
  const token = await readGoogleAccessToken(userId)
  return {
    linked: token !== null,
    hasDocsScope: token?.scopes.includes(DRIVE_FILE_SCOPE) ?? false
  }
}

/** A Docs-scoped token; also handed to the owner's own Google Picker. */
export async function getGoogleDocsToken(userId: string): Promise<string> {
  const token = await readGoogleAccessToken(userId)
  if (!token) {
    throw new GoogleDocsAccessError("not_linked", "Google account not linked")
  }
  if (!token.scopes.includes(DRIVE_FILE_SCOPE)) {
    throw new GoogleDocsAccessError(
      "scope_missing",
      "Google Docs access not granted yet"
    )
  }
  return token.accessToken
}

export function parseGoogleDocId(input: string): string | null {
  const trimmed = input.trim()
  const fromUrl = DOC_ID_PATTERN.exec(trimmed)?.[1]
  if (fromUrl) {
    return fromUrl
  }
  return RAW_DOC_ID_PATTERN.test(trimmed) ? trimmed : null
}

async function googleFetch<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (response.status === 404 || response.status === 403) {
    throw new GoogleDocsAccessError(
      "not_found",
      "Doc not found or not picked for FolioNote"
    )
  }
  if (!response.ok) {
    throw new GoogleDocsAccessError(
      "failed",
      `Google API request failed (${response.status})`
    )
  }
  return (await response.json()) as T
}

/** Raw Docs API document with every tab's content. */
export function fetchGoogleDocument<T>(
  token: string,
  docId: string
): Promise<T> {
  return googleFetch<T>(
    token,
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}?includeTabsContent=true`
  )
}

export interface DriveFileMeta {
  id: string
  name: string
  modifiedTime: string
  webViewLink?: string
}

/** Cheap change detection for "watch" mode: Drive modifiedTime. */
export function fetchDriveFileMeta(
  token: string,
  docId: string
): Promise<DriveFileMeta> {
  return googleFetch<DriveFileMeta>(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}?fields=id,name,modifiedTime,webViewLink`
  )
}
