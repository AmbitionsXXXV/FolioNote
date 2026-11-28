import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn()
}))

const mockAttachments = vi.hoisted(() => ({
  id: "attachments.id",
  userId: "attachments.user_id",
  entryId: "attachments.entry_id",
  filename: "attachments.filename",
  mimeType: "attachments.mime_type",
  storageKey: "attachments.storage_key",
  description: "attachments.description",
  descriptionModel: "attachments.description_model",
  descriptionGeneratedAt: "attachments.description_generated_at",
  deletedAt: "attachments.deleted_at",
  createdAt: "attachments.created_at"
}))

const mockEntries = vi.hoisted(() => ({
  id: "entries.id",
  userId: "entries.user_id",
  title: "entries.title",
  deletedAt: "entries.deleted_at"
}))

const mockCreateVercelAiChatModel = vi.hoisted(() => vi.fn())
const mockGenerateText = vi.hoisted(() => vi.fn())
const mockProviderSupports = vi.hoisted(() => vi.fn().mockReturnValue(true))

vi.mock("@folionote/db", () => ({
  db: mockDb,
  attachments: mockAttachments,
  entries: mockEntries
}))

vi.mock("@folionote/storage", () => ({
  getS3Config: vi.fn(() => ({
    publicUrl: "https://storage.example.com/object/public"
  })),
  STORAGE_BUCKETS: {
    ATTACHMENTS: "attachments"
  }
}))

vi.mock("@folionote/ai/vercel-ai", () => ({
  createVercelAiChatModel: mockCreateVercelAiChatModel
}))

vi.mock("@folionote/ai", () => ({
  PROVIDER_CONFIGS: {
    openai: { defaultBaseUrl: "https://api.openai.com/v1" },
    gemini: {
      defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta"
    },
    claude: { defaultBaseUrl: "https://api.anthropic.com/v1" }
  },
  providerSupports: mockProviderSupports
}))

vi.mock("ai", () => ({
  generateText: mockGenerateText,
  Output: {
    object: vi.fn().mockReturnValue({})
  }
}))

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  like: vi.fn((...args: unknown[]) => ({ type: "like", args })),
  sql: vi.fn((...args: unknown[]) => ({ type: "sql", args }))
}))

import {
  ensureAttachmentImageCaption,
  ensureEntryImageCaptions,
  isImageCaptionEnvFallbackEnabled
} from "../../src/services/image-captioning"

function createSelectChain(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ limit, orderBy })
  const from = vi.fn().mockReturnValue({ where, orderBy, limit })
  return { from, where, orderBy, limit }
}

function mockUpdateChain() {
  const where = vi.fn().mockResolvedValue()
  const set = vi.fn().mockReturnValue({ where })
  mockDb.update.mockReturnValue({ set })
  return { set, where }
}

const credential = {
  provider: "openai",
  apiKey: "test-key",
  baseUrl: "https://api.openai.com/v1"
}

describe("image-captioning service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.IMAGE_CAPTION_ALLOW_ENV_FALLBACK = undefined
    process.env.OPENAI_API_KEY = undefined
    mockProviderSupports.mockReturnValue(true)
    mockCreateVercelAiChatModel.mockReturnValue({
      modelId: "openai/gpt-4o-mini"
    })
    mockGenerateText.mockResolvedValue({
      output: {
        description:
          "Screenshot of a dashboard showing weekly retention and error rate."
      }
    })
  })

  it("returns null when attachment is not found", async () => {
    mockDb.select.mockReturnValueOnce(createSelectChain([]))

    const result = await ensureAttachmentImageCaption({
      userId: "user-1",
      attachmentId: "attachment-1",
      credential,
      allowEnvFallback: false
    })

    expect(result).toBeNull()
    expect(mockGenerateText).not.toHaveBeenCalled()
  })

  it("enables environment fallback only when explicitly opted in", () => {
    expect(isImageCaptionEnvFallbackEnabled()).toBe(false)

    process.env.IMAGE_CAPTION_ALLOW_ENV_FALLBACK = "true"
    expect(isImageCaptionEnvFallbackEnabled()).toBe(true)

    process.env.IMAGE_CAPTION_ALLOW_ENV_FALLBACK = "0"
    expect(isImageCaptionEnvFallbackEnabled()).toBe(false)
  })

  it("generates caption and persists description fields", async () => {
    mockDb.select
      .mockReturnValueOnce(
        createSelectChain([
          {
            id: "attachment-1",
            entryId: "entry-1",
            filename: "chart.png",
            mimeType: "image/png",
            storageKey: "user-1/entries/entry-1/chart.png",
            description: null
          }
        ])
      )
      .mockReturnValueOnce(createSelectChain([{ title: "Weekly Review" }]))

    const { set } = mockUpdateChain()

    const result = await ensureAttachmentImageCaption({
      userId: "user-1",
      attachmentId: "attachment-1",
      credential,
      model: "gpt-4o-mini",
      allowEnvFallback: false
    })

    expect(result).not.toBeNull()
    expect(result?.attachmentId).toBe("attachment-1")
    expect(result?.description).toContain("dashboard")
    expect(result?.modelId).toBe("openai/gpt-4o-mini")
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const toolCall = mockGenerateText.mock.calls[0]?.[0]
    expect(toolCall?.messages?.[0]?.content?.[0]?.data?.toString()).toBe(
      "https://storage.example.com/object/public/attachments/user-1/entries/entry-1/chart.png"
    )
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Screenshot of a dashboard showing weekly retention and error rate.",
        descriptionModel: "openai/gpt-4o-mini",
        descriptionGeneratedAt: expect.any(Date)
      })
    )
  })

  it("batch caption only processes attachments without description", async () => {
    mockDb.select
      .mockReturnValueOnce(
        createSelectChain([
          { id: "attachment-1", description: null },
          { id: "attachment-2", description: "existing description" }
        ])
      )
      .mockReturnValueOnce(
        createSelectChain([
          {
            id: "attachment-1",
            entryId: "entry-1",
            filename: "chart.png",
            mimeType: "image/png",
            storageKey: "user-1/entries/entry-1/chart.png",
            description: null
          }
        ])
      )
      .mockReturnValueOnce(createSelectChain([{ title: "Weekly Review" }]))

    mockUpdateChain()

    const generatedCount = await ensureEntryImageCaptions({
      userId: "user-1",
      entryIds: ["entry-1"],
      credential,
      allowEnvFallback: false
    })

    expect(generatedCount).toBe(1)
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
  })

  it("uses environment credential fallback only when allowed and configured", async () => {
    process.env.OPENAI_API_KEY = "platform-openai-key"
    mockDb.select
      .mockReturnValueOnce(
        createSelectChain([
          {
            id: "attachment-1",
            entryId: "entry-1",
            filename: "chart.png",
            mimeType: "image/png",
            storageKey: "user-1/entries/entry-1/chart.png",
            description: null
          }
        ])
      )
      .mockReturnValueOnce(createSelectChain([{ title: "Weekly Review" }]))

    mockUpdateChain()

    const result = await ensureAttachmentImageCaption({
      userId: "user-1",
      attachmentId: "attachment-1",
      allowEnvFallback: true
    })

    expect(result?.modelId).toBe("openai/gpt-4o-mini")
    expect(mockCreateVercelAiChatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "platform-openai-key",
        provider: "openai"
      }),
      { model: undefined }
    )
  })
})
