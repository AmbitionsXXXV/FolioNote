import { db, externalConnections } from "@folionote/db"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"

import {
  NotionApiError,
  readNotionOAuthConfig,
  refreshNotionToken
} from "./notion"
import type { NotionTokenResponse } from "./notion"
import { decryptToken, encryptToken } from "./token-crypto"

type ConnectionRow = typeof externalConnections.$inferSelect

const UNAUTHORIZED_STATUS = 401

/**
 * Upsert by (user, bot_id): re-authorizing the same workspace to edit page
 * access returns the same bot_id with a NEW token pair, which must replace
 * the stored one (Notion's docs: store the pair from every response).
 */
export async function saveNotionConnection(
  userId: string,
  token: NotionTokenResponse
): Promise<ConnectionRow> {
  const values = {
    workspaceId: token.workspace_id,
    workspaceName: token.workspace_name ?? null,
    workspaceIcon: token.workspace_icon ?? null,
    accessTokenEncrypted: await encryptToken(token.access_token),
    refreshTokenEncrypted: token.refresh_token
      ? await encryptToken(token.refresh_token)
      : null
  }
  const [row] = await db
    .insert(externalConnections)
    .values({
      id: nanoid(),
      userId,
      provider: "notion",
      externalAccountId: token.bot_id,
      ...values
    })
    .onConflictDoUpdate({
      target: [
        externalConnections.userId,
        externalConnections.provider,
        externalConnections.externalAccountId
      ],
      set: values
    })
    .returning()
  if (!row) {
    throw new Error("Failed to save Notion connection")
  }
  return row
}

export function listNotionConnections(
  userId: string
): Promise<ConnectionRow[]> {
  return db
    .select()
    .from(externalConnections)
    .where(
      and(
        eq(externalConnections.userId, userId),
        eq(externalConnections.provider, "notion")
      )
    )
}

export async function getNotionConnection(
  userId: string,
  connectionId: string
): Promise<ConnectionRow | null> {
  const [row] = await db
    .select()
    .from(externalConnections)
    .where(
      and(
        eq(externalConnections.id, connectionId),
        eq(externalConnections.userId, userId),
        eq(externalConnections.provider, "notion")
      )
    )
  return row ?? null
}

export async function deleteNotionConnection(
  userId: string,
  connectionId: string
): Promise<boolean> {
  const deleted = await db
    .delete(externalConnections)
    .where(
      and(
        eq(externalConnections.id, connectionId),
        eq(externalConnections.userId, userId)
      )
    )
    .returning({ id: externalConnections.id })
  return deleted.length > 0
}

async function refreshConnection(
  connection: ConnectionRow
): Promise<ConnectionRow | null> {
  const config = readNotionOAuthConfig()
  if (!(config && connection.refreshTokenEncrypted)) {
    return null
  }
  const refreshed = await refreshNotionToken(
    config,
    await decryptToken(connection.refreshTokenEncrypted)
  )
  return saveNotionConnection(connection.userId, refreshed)
}

/**
 * Runs `operation` with the connection's access token; on 401 refreshes the
 * pair once and retries. A second 401 propagates so the UI can ask the user
 * to reconnect.
 */
export async function withNotionToken<T>(
  connection: ConnectionRow,
  operation: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await operation(await decryptToken(connection.accessTokenEncrypted))
  } catch (error) {
    if (
      !(error instanceof NotionApiError) ||
      error.status !== UNAUTHORIZED_STATUS
    ) {
      throw error
    }
    const refreshed = await refreshConnection(connection)
    if (!refreshed) {
      throw error
    }
    return operation(await decryptToken(refreshed.accessTokenEncrypted))
  }
}
