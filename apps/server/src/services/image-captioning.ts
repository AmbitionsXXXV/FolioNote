import { PROVIDER_CONFIGS, providerSupports } from "@folionote/ai"
import type { DecryptedCredential } from "@folionote/ai"
import { createVercelAiChatModel } from "@folionote/ai/vercel-ai"
import { attachments, db, entries } from "@folionote/db"
import { createLogger } from "@folionote/log"
import { getS3Config, STORAGE_BUCKETS } from "@folionote/storage"
import { generateText, Output } from "ai"
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm"
import { z } from "zod"

const log = createLogger({ prefix: "image-captioning" })

const DEFAULT_MAX_BATCH_COUNT = 3
const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"])
const SUPPORTED_PUBLIC_IMAGE_PROTOCOLS = new Set(["http:", "https:"])
const TRAILING_SLASHES_REGEX = /\/+$/

const ImageCaptionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1)
    .max(1200)
    .describe(
      "Searchable caption of the image, including visible text and key entities."
    )
})

const IMAGE_CAPTION_SYSTEM_PROMPT = [
  "You create searchable image captions for personal knowledge notes.",
  "Describe what is visibly present in the image with concrete nouns and actions.",
  "If there is readable text, include the key text content in the description.",
  "Prefer factual wording and avoid guesses about unseen context.",
  "Return the result as plain descriptive text in the user language when obvious, otherwise use English."
].join("\n")

interface AttachmentRow {
  id: string
  entryId: string | null
  filename: string
  mimeType: string
  storageKey: string
  description: string | null
}

export interface EnsureAttachmentImageCaptionInput {
  userId: string
  attachmentId: string
  credential?: DecryptedCredential
  model?: string
  force?: boolean
  allowEnvFallback?: boolean
}

export interface EnsureEntryImageCaptionsInput {
  userId: string
  entryIds: string[]
  credential?: DecryptedCredential
  model?: string
  maxCount?: number
  allowEnvFallback?: boolean
}

export interface EnsureAttachmentImageCaptionResult {
  attachmentId: string
  description: string
  modelId: string
  generatedAt: Date
}

export function isImageCaptionEnvFallbackEnabled(): boolean {
  const rawValue =
    process.env.IMAGE_CAPTION_ALLOW_ENV_FALLBACK?.trim().toLowerCase()
  return rawValue ? TRUE_ENV_VALUES.has(rawValue) : false
}

function resolveEnvVisionCredential(): DecryptedCredential | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: PROVIDER_CONFIGS.openai.defaultBaseUrl
    }
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      baseUrl: PROVIDER_CONFIGS.gemini.defaultBaseUrl
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "claude",
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: PROVIDER_CONFIGS.claude.defaultBaseUrl
    }
  }

  return null
}

function resolveCaptionCredential(
  credential: DecryptedCredential | undefined,
  allowEnvFallback: boolean
): DecryptedCredential | null {
  if (credential) {
    if (providerSupports(credential.provider, "vision")) {
      return credential
    }
    if (!allowEnvFallback) {
      return null
    }
  }

  if (!allowEnvFallback) {
    return null
  }

  return resolveEnvVisionCredential()
}

function buildAttachmentPublicBaseUrl(): URL {
  const s3Config = getS3Config()
  const normalizedPublicUrl = s3Config.publicUrl.replace(
    TRAILING_SLASHES_REGEX,
    ""
  )
  const baseUrl = new URL(
    `${normalizedPublicUrl}/${STORAGE_BUCKETS.ATTACHMENTS}/`
  )

  if (!SUPPORTED_PUBLIC_IMAGE_PROTOCOLS.has(baseUrl.protocol)) {
    throw new Error("Attachment public URL must use http:// or https://")
  }

  if (baseUrl.username || baseUrl.password) {
    throw new Error(
      "Attachment public URL must not include embedded credentials"
    )
  }

  return baseUrl
}

function getAttachmentPublicUrl(storageKey: string): string {
  const baseUrl = buildAttachmentPublicBaseUrl()
  const encodedStorageKey = storageKey
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  if (!encodedStorageKey) {
    throw new Error("Attachment storage key is required")
  }

  return new URL(encodedStorageKey, baseUrl).toString()
}

function buildCaptionPrompt(noteTitle?: string, filename?: string): string {
  const header = [
    "Generate one concise but searchable image caption.",
    "Focus on objects, structure, and visible text (OCR) that can help retrieval."
  ]

  if (noteTitle && noteTitle.trim().length > 0) {
    header.push(`Related note title: ${noteTitle}`)
  }

  if (filename && filename.trim().length > 0) {
    header.push(`File name: ${filename}`)
  }

  return header.join("\n")
}

async function getAttachmentRow(
  userId: string,
  attachmentId: string
): Promise<AttachmentRow | null> {
  const [attachment] = await db
    .select({
      id: attachments.id,
      entryId: attachments.entryId,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      storageKey: attachments.storageKey,
      description: attachments.description
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.userId, userId),
        eq(attachments.id, attachmentId),
        isNull(attachments.deletedAt)
      )
    )
    .limit(1)

  return attachment ?? null
}

async function getEntryTitle(
  userId: string,
  entryId: string | null
): Promise<string | undefined> {
  if (!entryId) {
    return undefined
  }

  const [entry] = await db
    .select({
      title: entries.title
    })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.id, entryId),
        isNull(entries.deletedAt)
      )
    )
    .limit(1)

  return entry?.title
}

async function generateCaptionText(params: {
  imageUrl: string
  mimeType: string
  credential: DecryptedCredential
  model?: string
  noteTitle?: string
  filename?: string
}): Promise<{ description: string; modelId: string }> {
  const model = createVercelAiChatModel(params.credential, {
    model: params.model
  })

  const result = await generateText({
    model,
    output: Output.object({ schema: ImageCaptionSchema }),
    instructions: IMAGE_CAPTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: new URL(params.imageUrl),
            mediaType: params.mimeType
          },
          {
            type: "text",
            text: buildCaptionPrompt(params.noteTitle, params.filename)
          }
        ]
      }
    ]
  })

  const description = result.output?.description.trim()
  if (!description) {
    throw new Error("Caption generation returned empty description")
  }

  return { description, modelId: model.modelId }
}

export async function ensureAttachmentImageCaption(
  input: EnsureAttachmentImageCaptionInput
): Promise<EnsureAttachmentImageCaptionResult | null> {
  const allowEnvFallback = input.allowEnvFallback ?? false
  const attachment = await getAttachmentRow(input.userId, input.attachmentId)

  if (!attachment) {
    return null
  }

  if (!input.force && attachment.description?.trim()) {
    return null
  }

  if (!attachment.mimeType.startsWith("image/")) {
    return null
  }

  const credential = resolveCaptionCredential(
    input.credential,
    allowEnvFallback
  )
  if (!credential) {
    log.debug(
      `Skip caption generation for attachment ${attachment.id}: no usable vision credential`
    )
    return null
  }

  try {
    const noteTitle = await getEntryTitle(input.userId, attachment.entryId)
    const imageUrl = getAttachmentPublicUrl(attachment.storageKey)
    const caption = await generateCaptionText({
      imageUrl,
      mimeType: attachment.mimeType,
      credential,
      model: input.model,
      noteTitle,
      filename: attachment.filename
    })
    const generatedAt = new Date()

    await db
      .update(attachments)
      .set({
        description: caption.description,
        descriptionModel: caption.modelId,
        descriptionGeneratedAt: generatedAt
      })
      .where(eq(attachments.id, attachment.id))

    return {
      attachmentId: attachment.id,
      description: caption.description,
      modelId: caption.modelId,
      generatedAt
    }
  } catch (error) {
    log.warn(
      `Failed to generate caption for attachment ${attachment.id}:`,
      error
    )
    return null
  }
}

export async function ensureEntryImageCaptions(
  input: EnsureEntryImageCaptionsInput
): Promise<number> {
  const uniqueEntryIds = [
    ...new Set(input.entryIds.filter((entryId) => entryId.length > 0))
  ]
  if (uniqueEntryIds.length === 0) {
    return 0
  }

  const maxCount = input.maxCount ?? DEFAULT_MAX_BATCH_COUNT
  if (maxCount <= 0) {
    return 0
  }

  const rows = await db
    .select({
      id: attachments.id,
      description: attachments.description
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.userId, input.userId),
        isNull(attachments.deletedAt),
        inArray(attachments.entryId, uniqueEntryIds),
        // Filter before the limit: otherwise already-captioned or non-image
        // rows use up the batch and the remaining images are never captioned.
        like(attachments.mimeType, "image/%"),
        sql`coalesce(trim(${attachments.description}), '') = ''`
      )
    )
    .limit(maxCount)

  let generatedCount = 0
  for (const row of rows) {
    if (row.description?.trim()) {
      continue
    }
    const result = await ensureAttachmentImageCaption({
      userId: input.userId,
      attachmentId: row.id,
      credential: input.credential,
      model: input.model,
      allowEnvFallback: input.allowEnvFallback
    })
    if (result) {
      generatedCount += 1
    }
  }

  return generatedCount
}
