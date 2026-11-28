import { Button } from "@folionote/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@folionote/ui/sheet"
import {
  AiBrain01Icon,
  MessageAdd01Icon,
  Setting06Icon,
  SidebarLeftIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Fragment,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
import type { ChangeEvent, RefObject } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  findAtIndex,
  MentionPopover,
  useMentionPopover
} from "@/components/ai-elements/chat-input/mention-popover"
import type { MentionItem } from "@/components/ai-elements/chat-input/mention-popover"
import { NoteAttachment } from "@/components/ai-elements/chat-input/note-attachment"
import type { AttachedNote } from "@/components/ai-elements/chat-input/types"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton
} from "@/components/ai-elements/conversation"
import { AiModelSelector } from "@/components/ai-elements/model-selector"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools
} from "@/components/ai-elements/prompt-input"
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import type { ToolApprovalHandler } from "@/components/ai-elements/tool-approval"
import { AttachmentDisplay } from "@/features/knowledge/components/attachment-display"
import {
  ChatMessageItem,
  WaitingIndicator
} from "@/features/knowledge/components/chat-message-item"
import type { WebSearchPanelOpenHandler } from "@/features/knowledge/components/chat-message-item"
import { CompactMessage } from "@/features/knowledge/components/compact-message"
import {
  buildContextPopoverDetails,
  ContextCompactBanner,
  ContextUsagePopover
} from "@/features/knowledge/components/context-usage-section"
import { ImageGenerationToggle } from "@/features/knowledge/components/image-generation-toggle"
import { ThinkingToggle } from "@/features/knowledge/components/thinking-toggle"
import { WebSearchPanel } from "@/features/knowledge/components/web-search-panel"
import type { WebSearchPanelData } from "@/features/knowledge/components/web-search-panel"
import { WebSearchToggle } from "@/features/knowledge/components/web-search-toggle"
import type { ChatSessionSummary } from "@/features/knowledge/types"
import { isApiSupportedProvider } from "@/features/knowledge/utils"
import { useAiModelCatalog } from "@/hooks/use-ai-model-catalog"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import { useGenerateImage } from "@/hooks/use-generate-image"
import { useKnowledgeChat } from "@/hooks/use-knowledge-chat"
import type { KnowledgeChatMessage } from "@/hooks/use-knowledge-chat"
import { useLastUsedModel } from "@/hooks/use-last-used-model"
import { useModelProviderConfig } from "@/hooks/use-model-provider-config"
import { useProviderApiKey } from "@/hooks/use-provider-api-key"
import { useSessionContextUsage } from "@/hooks/use-session-context-usage"
import { cn } from "@/lib/utils"
import type { Entry } from "@/types"
import { orpc } from "@/utils/orpc"

const MENTION_QUERY_LIMIT = 100

export const Route = createFileRoute("/_app/knowledge")({
  component: KnowledgePage
})

const FILE_ATTACHMENT_ACCEPT = "image/*,application/pdf"
const FILE_ATTACHMENT_MAX_FILES = 5
const FILE_ATTACHMENT_MAX_BYTES = 5_242_880
const SIDEBAR_COLLAPSED_STORAGE_KEY = "folionote:knowledge:sidebarCollapsed"

const LazyChatHistoryPanel = lazy(async () => {
  const module =
    await import("@/features/knowledge/components/chat-history-panel")
  return { default: module.ChatHistoryPanel }
})

function preloadChatHistoryPanel(): void {
  import("@/features/knowledge/components/chat-history-panel").catch(() => {
    // Preload failures are non-fatal; the lazy load will still run.
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed"
}

interface ChatHistorySidebarProps {
  className?: string
  isLoading: boolean
  sessions: ChatSessionSummary[]
  selectedChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
}

const ChatHistorySidebar = memo((props: ChatHistorySidebarProps) => {
  return (
    <Suspense
      fallback={
        <div className="h-full space-y-2 border-r bg-background p-3">
          <div className="h-10 rounded-lg bg-surface-secondary/60" />
          <div className="h-18 rounded-lg bg-surface-secondary/40" />
          <div className="h-18 rounded-lg bg-surface-secondary/40" />
        </div>
      }
    >
      <LazyChatHistoryPanel
        className={props.className}
        isLoading={props.isLoading}
        onDeleteChat={props.onDeleteChat}
        onNewChat={props.onNewChat}
        onSelectChat={props.onSelectChat}
        selectedChatId={props.selectedChatId}
        sessions={props.sessions}
      />
    </Suspense>
  )
})

function computeShowWaiting(
  isPending: boolean,
  messages: {
    isStreaming?: boolean
    content: string
    thinking?: string
    parts?: Array<{ type: string }>
  }[]
): boolean {
  if (!isPending) {
    return false
  }
  const hasStreamingContent = (p: { type: string }) =>
    p.type === "reasoning" || p.type.startsWith("tool-")
  return !messages.some(
    (m) =>
      m.isStreaming &&
      (m.content.length > 0 ||
        (m.thinking?.length ?? 0) > 0 ||
        (m.parts ?? []).some(hasStreamingContent))
  )
}

function applyMentionSelection(
  item: MentionItem,
  textareaRef: { current: HTMLTextAreaElement | null },
  callbackRefs: {
    current: {
      inputValue: string
      setInputValue: (v: string) => void
      handleAddNote: (note: AttachedNote) => void
    }
  }
) {
  callbackRefs.current.handleAddNote({ id: item.id, title: item.title })

  const textarea = textareaRef.current
  if (!textarea) {
    return
  }

  const cursorPos = textarea.selectionStart
  const currentValue = callbackRefs.current.inputValue
  const atIndex = findAtIndex(currentValue, cursorPos)

  if (atIndex >= 0) {
    const before = currentValue.slice(0, atIndex)
    const after = currentValue.slice(cursorPos)
    const inserted = `@${item.title} `
    callbackRefs.current.setInputValue(before + inserted + after)

    const newCursorPos = before.length + inserted.length
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    })
  }
}

function addNoteIfAbsent(
  note: AttachedNote,
  setNotes: (fn: (prev: AttachedNote[]) => AttachedNote[]) => void
) {
  setNotes((prev) =>
    prev.some((n) => n.id === note.id) ? prev : [...prev, note]
  )
}

function resolveInputPlaceholder(
  t: ReturnType<typeof useTranslation>["t"],
  hasApiKey: boolean,
  isImageMode: boolean
): string {
  if (!hasApiKey) {
    return t("knowledge.configureApiKeyFirst")
  }
  if (isImageMode) {
    return t("knowledge.imagePromptPlaceholder", {
      defaultValue: "Describe the image you want to create\u2026"
    })
  }
  return t("knowledge.inputPlaceholder")
}

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
}

function useMentionKeyHandler(
  textareaRef: { current: HTMLTextAreaElement | null },
  handleKey: (key: string) => boolean
) {
  const handleKeyRef = useRef(handleKey)
  handleKeyRef.current = handleKey
  useEffect(() => {
    const node = textareaRef.current
    if (!node) {
      return
    }
    const handler = (e: KeyboardEvent) => {
      if (handleKeyRef.current(e.key)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    node.addEventListener("keydown", handler, { capture: true })
    return () => node.removeEventListener("keydown", handler, { capture: true })
  })
}

function useErrorToasts(
  chatError: Error | undefined | null,
  sessionsError: Error | undefined | null,
  t: ReturnType<typeof useTranslation>["t"]
) {
  useEffect(() => {
    const error = chatError || sessionsError
    if (error) {
      toast.error(error.message || t("knowledge.requestFailed"))
    }
  }, [chatError, sessionsError, t])
}

function useSyncThinkingState(
  supportsThinking: boolean,
  hasToggleableReasoning: boolean,
  setThinkingEnabled: (v: boolean) => void
) {
  useEffect(() => {
    if (!supportsThinking) {
      setThinkingEnabled(false)
      return
    }
    if (hasToggleableReasoning) {
      return
    }
    setThinkingEnabled(true)
  }, [supportsThinking, hasToggleableReasoning, setThinkingEnabled])
}

function useSyncSidebarCollapsed(isCollapsed: boolean) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      isCollapsed ? "true" : "false"
    )
  }, [isCollapsed])
}

function buildMentionCandidates(
  rawItems: Entry[] | undefined,
  excludeIds: Set<string>,
  t: ReturnType<typeof useTranslation>["t"]
): MentionItem[] {
  const entries = (rawItems ?? []) as Entry[]
  const items: MentionItem[] = []
  for (const entry of entries) {
    if (entry.isInbox) {
      continue
    }
    if (excludeIds.has(entry.id)) {
      continue
    }
    const rawTitle = entry.title?.trim() ?? ""
    const title = rawTitle.length > 0 ? rawTitle : t("entryPicker.untitled")
    items.push({ id: entry.id, title })
  }
  return items
}

interface CatalogModel {
  providerId: string
  id: string
  type: string
  enabled: boolean
}
interface CatalogProvider {
  id: string
}

function findValidProviderAndModel(
  catalogModels: CatalogModel[],
  catalogProviders: CatalogProvider[],
  currentProvider: string,
  currentModel: string
): { provider: string; model: string } {
  const enabled = catalogModels.filter(
    (m) =>
      m.providerId === currentProvider &&
      (m.type === "chat" || m.type === "image") &&
      m.enabled
  )
  if (enabled.length > 0) {
    if (enabled.some((m) => m.id === currentModel)) {
      return { provider: currentProvider, model: currentModel }
    }
    const firstChat = enabled.find((m) => m.type === "chat")
    return {
      provider: currentProvider,
      model: firstChat?.id ?? enabled[0]?.id ?? ""
    }
  }
  for (const provider of catalogProviders) {
    const models = catalogModels.filter(
      (m) =>
        m.providerId === provider.id &&
        (m.type === "chat" || m.type === "image") &&
        m.enabled
    )
    const firstChat = models.find((m) => m.type === "chat")
    const first = firstChat ?? models[0]
    if (first) {
      return { provider: provider.id, model: first.id }
    }
  }
  return { provider: currentProvider, model: "" }
}

function useInitModelSelection(opts: {
  catalogModels: CatalogModel[]
  catalogProviders: CatalogProvider[]
  isModelConfigLoaded: boolean
  isCatalogLoaded: boolean
  lastUsedProvider?: string
  lastUsedModel?: string
  defaultProvider: string
  defaultModel?: string | null
  setSelectedProvider: (v: string) => void
  setSelectedModel: (v: string) => void
}) {
  useEffect(() => {
    if (!(opts.isModelConfigLoaded && opts.isCatalogLoaded)) {
      return
    }
    const preferredProvider = opts.lastUsedProvider || opts.defaultProvider
    const preferredModel = opts.lastUsedModel || opts.defaultModel || ""
    const { provider, model } = findValidProviderAndModel(
      opts.catalogModels,
      opts.catalogProviders,
      preferredProvider,
      preferredModel
    )
    opts.setSelectedProvider(provider)
    opts.setSelectedModel(model)
  }, [
    opts.catalogModels,
    opts.catalogProviders,
    opts.isModelConfigLoaded,
    opts.isCatalogLoaded,
    opts.defaultProvider,
    opts.defaultModel,
    opts.lastUsedProvider,
    opts.lastUsedModel,
    opts.setSelectedProvider,
    opts.setSelectedModel
  ])
}

function useAutoCompact(opts: {
  selectedChatId: string | null
  sessionContextUsage: ReturnType<typeof useSessionContextUsage>
  isPending: boolean
  isCompacting: boolean
  messagesLength: number
  compactContext: (input: {
    tokensToCompact: number
  }) => Promise<{ compactedCount: number } | null>
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const keyRef = useRef<string | null>(null)
  useEffect(() => {
    keyRef.current = null
  }, [opts.selectedChatId])
  useEffect(() => {
    if (!opts.selectedChatId) {
      return
    }
    if (!opts.sessionContextUsage?.shouldCompact) {
      return
    }
    if (opts.isPending || opts.isCompacting) {
      return
    }
    const key = [
      opts.selectedChatId,
      opts.messagesLength,
      opts.sessionContextUsage.tokensToCompact
    ].join(":")
    if (keyRef.current === key) {
      return
    }
    keyRef.current = key
    opts
      .compactContext({
        tokensToCompact: opts.sessionContextUsage.tokensToCompact
      })
      .then((result) => {
        if (!result) {
          return
        }
        toast.success(
          opts.t("knowledge.compactMessage.success", {
            count: result.compactedCount
          })
        )
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error))
      })
  }, [
    opts.compactContext,
    opts.isCompacting,
    opts.isPending,
    opts.messagesLength,
    opts.selectedChatId,
    opts.sessionContextUsage,
    opts.t
  ])
}

interface ChatConversationContentProps {
  messages: KnowledgeChatMessage[]
  sessionContextUsage: ReturnType<typeof useSessionContextUsage>
  isCompacting: boolean
  showWaiting: boolean
  thinkingEnabled: boolean
  handleCompactNow: () => void
  handleOpenWebSearchPanel: WebSearchPanelOpenHandler
  addToolApprovalResponse: ToolApprovalHandler
}

function ChatConversationContent(props: ChatConversationContentProps) {
  const { t } = useTranslation()
  const {
    messages,
    sessionContextUsage,
    isCompacting,
    showWaiting,
    thinkingEnabled
  } = props

  if (messages.length === 0) {
    return (
      <ConversationContent className="gap-4 p-4">
        <ConversationEmptyState
          description={t("knowledge.emptyState.description")}
          icon={
            <HugeiconsIcon
              className="size-12 text-muted-foreground/50"
              icon={AiBrain01Icon}
            />
          }
          title={t("knowledge.emptyState.title")}
        />
      </ConversationContent>
    )
  }

  return (
    <ConversationContent className="gap-4 p-4">
      {sessionContextUsage ? (
        <ContextCompactBanner
          contextUsage={sessionContextUsage}
          isCompacting={isCompacting}
          onCompact={props.handleCompactNow}
        />
      ) : null}
      {messages.map((message) => (
        <Fragment key={message.id}>
          {message.compactInfo ? (
            <CompactMessage
              compactInfo={message.compactInfo}
              summary={message.content}
            />
          ) : (
            <ChatMessageItem
              message={message}
              onOpenWebSearchPanel={props.handleOpenWebSearchPanel}
              onToolApprovalResponse={props.addToolApprovalResponse}
              thinkingEnabled={thinkingEnabled}
            />
          )}
        </Fragment>
      ))}
      {showWaiting ? <WaitingIndicator /> : null}
    </ConversationContent>
  )
}

function useKnowledgePage() {
  const { t } = useTranslation()

  const { config } = useModelProviderConfig()
  const {
    providers: catalogProviders,
    models: catalogModels,
    isLoaded: isCatalogLoaded
  } = useAiModelCatalog()
  const { lastUsedProvider, lastUsedModel, saveLastUsed } = useLastUsedModel()

  const [selectedProvider, setSelectedProvider] = useState(
    config.defaultProvider
  )
  const [selectedModel, setSelectedModel] = useState(config.defaultModel ?? "")
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(
    getInitialSidebarCollapsed
  )
  const [isMobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [attachedNotes, setAttachedNotes] = useState<AttachedNote[]>([])
  const [webSearchPanelOpen, setWebSearchPanelOpen] = useState(false)
  const [webSearchPanelData, setWebSearchPanelData] =
    useState<WebSearchPanelData | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const loadedChatIdRef = useRef<string | null>(null)

  const {
    sessions,
    selectedChatId,
    isLoading: isSessionsLoading,
    error: sessionsError,
    refreshSessions,
    selectChat,
    createChat,
    deleteChat,
    deleteEmptyChat,
    isSessionEmpty
  } = useChatSessions({
    autoLoad: true,
    autoCreateIfEmpty: true
  })

  const {
    apiProviderId,
    activeApiKey,
    activeBaseUrl,
    hasApiKey,
    isModelConfigLoaded
  } = useProviderApiKey(selectedProvider)

  const { generate: generateImage, isGenerating: isImageGenerating } =
    useGenerateImage()

  const handleMessageComplete = useCallback(async () => {
    await refreshSessions({ silent: true })
  }, [refreshSessions])

  const {
    messages,
    isStreaming,
    isLoading,
    isCompacting,
    error: chatError,
    sendMessage,
    compactContext,
    addToolApprovalResponse,
    clearMessages,
    loadMessages,
    restoreFromCache,
    resetChat,
    setMessages
  } = useKnowledgeChat({
    chatId: selectedChatId ?? "",
    provider: apiProviderId,
    apiKey: activeApiKey,
    baseUrl: activeBaseUrl,
    model: selectedModel.trim() || "",
    enableReasoning: thinkingEnabled,
    enableWebSearch: webSearchEnabled,
    enableImageGeneration: imageGenerationEnabled,
    onMessageComplete: handleMessageComplete
  })

  const isPending =
    isStreaming || isLoading || isCompacting || isImageGenerating
  const firstSessionId = sessions[0]?.chatId

  // ---- @ Mention: entries query and candidates ----

  const { data: entriesData } = useQuery({
    queryKey: ["entries", "library", "mention"],
    queryFn: () =>
      orpc.entries.list.call({
        filter: "all",
        limit: MENTION_QUERY_LIMIT
      })
  })

  const attachedNoteIds = useMemo(
    () => new Set(attachedNotes.map((n) => n.id)),
    [attachedNotes]
  )

  const mentionCandidates = useMemo<MentionItem[]>(
    () => buildMentionCandidates(entriesData?.items, attachedNoteIds, t),
    [entriesData, attachedNoteIds, t]
  )

  const handleAddNote = useCallback(
    (note: AttachedNote) => addNoteIfAbsent(note, setAttachedNotes),
    []
  )

  const handleRemoveNote = useCallback((noteId: string) => {
    setAttachedNotes((prev) => prev.filter((n) => n.id !== noteId))
  }, [])

  const callbackRefs = useRef({ inputValue, setInputValue, handleAddNote })
  callbackRefs.current = { inputValue, setInputValue, handleAddNote }

  const handleMentionSelect = useCallback(
    (item: MentionItem) =>
      applyMentionSelection(item, textareaRef, callbackRefs),
    []
  )

  const mentionEmptyText = t(
    mentionCandidates.length === 0
      ? "entryPicker.noEntriesAvailable"
      : "entryPicker.noMatchingEntries"
  )

  const mention = useMentionPopover({
    items: mentionCandidates,
    onSelect: handleMentionSelect,
    emptyText: mentionEmptyText,
    anchorRef: textareaRef
  })

  useMentionKeyHandler(textareaRef, mention.handleKey)

  const handleTextareaChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.currentTarget.value
      const cursorPos = e.currentTarget.selectionStart
      setInputValue(newValue)
      mention.detectMention(newValue, cursorPos)
    },
    [mention.detectMention]
  )

  useInitModelSelection({
    catalogModels,
    catalogProviders,
    isModelConfigLoaded,
    isCatalogLoaded,
    lastUsedProvider,
    lastUsedModel,
    defaultProvider: config.defaultProvider,
    defaultModel: config.defaultModel,
    setSelectedProvider,
    setSelectedModel
  })

  // Model info for thinking and image mode
  const selectedModelInfo = useMemo(
    () =>
      catalogModels.find(
        (m) => m.providerId === selectedProvider && m.id === selectedModel
      ),
    [catalogModels, selectedProvider, selectedModel]
  )
  const isImageMode = selectedModelInfo?.type === "image"
  const supportsThinking = !isImageMode && Boolean(selectedModelInfo?.reasoning)
  const hasToggleableReasoning = Boolean(
    selectedModelInfo?.settings?.extendParams?.includes("enableReasoning")
  )
  const thinkingActive = hasToggleableReasoning ? thinkingEnabled : true
  const sessionContextUsage = useSessionContextUsage({
    messages,
    providerId: selectedProvider,
    modelId: selectedModel,
    modelContextWindowTokens: selectedModelInfo?.contextWindowTokens
  })

  useSyncThinkingState(
    supportsThinking,
    hasToggleableReasoning,
    setThinkingEnabled
  )

  useErrorToasts(chatError, sessionsError, t)

  useSyncSidebarCollapsed(isHistoryCollapsed)

  useEffect(() => {
    if (!selectedChatId) {
      loadedChatIdRef.current = null
      clearMessages()
      return
    }

    if (loadedChatIdRef.current === selectedChatId) {
      return
    }

    loadedChatIdRef.current = selectedChatId

    // Synchronously restore from cache to avoid blank flash, then revalidate
    restoreFromCache(selectedChatId)
    loadMessages(selectedChatId).catch((error: unknown) => {
      loadedChatIdRef.current = null
      toast.error(getErrorMessage(error))
    })
  }, [selectedChatId, clearMessages, loadMessages, restoreFromCache])

  useAutoCompact({
    selectedChatId,
    sessionContextUsage,
    isPending,
    isCompacting,
    messagesLength: messages.length,
    compactContext,
    t
  })

  useEffect(() => {
    if (isSessionsLoading || selectedChatId) {
      return
    }

    if (firstSessionId) {
      selectChat(firstSessionId)
      return
    }

    createChat()
      .then((newChatId) => {
        loadedChatIdRef.current = newChatId
        resetChat(newChatId)
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error))
      })
  }, [
    isSessionsLoading,
    selectedChatId,
    firstSessionId,
    selectChat,
    createChat,
    resetChat
  ])

  // Handlers
  const handleModelChange = useCallback(
    (modelId: string, providerId?: string) => {
      const matched =
        providerId ||
        catalogModels.find((m) => m.id === modelId)?.providerId ||
        selectedProvider
      setSelectedProvider(matched)
      setSelectedModel(modelId)
      saveLastUsed(matched, modelId)
    },
    [catalogModels, selectedProvider, saveLastUsed]
  )

  const handleSelectChat = useCallback(
    (chatSessionId: string) => {
      if (isPending || chatSessionId === selectedChatId) {
        setMobileHistoryOpen(false)
        return
      }
      selectChat(chatSessionId)
      setMobileHistoryOpen(false)
    },
    [isPending, selectedChatId, selectChat]
  )

  const handleNewChat = useCallback(async () => {
    if (isPending) {
      return
    }

    try {
      if (selectedChatId && isSessionEmpty(selectedChatId)) {
        await deleteEmptyChat(selectedChatId)
      }
      const newChatId = await createChat()
      loadedChatIdRef.current = newChatId
      resetChat(newChatId)
      setInputValue("")
      setAttachedNotes([])
      setMobileHistoryOpen(false)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    }
  }, [
    isPending,
    selectedChatId,
    isSessionEmpty,
    deleteEmptyChat,
    createChat,
    resetChat
  ])

  const handleDeleteChat = useCallback(
    async (chatSessionId: string) => {
      if (isPending) {
        return
      }

      try {
        const wasDeleted = await deleteChat(chatSessionId)
        if (!wasDeleted) {
          return
        }

        if (chatSessionId === selectedChatId) {
          loadedChatIdRef.current = null
          clearMessages()
        }

        setMobileHistoryOpen(false)
        await refreshSessions({ silent: true })
      } catch (error: unknown) {
        toast.error(getErrorMessage(error))
      }
    },
    [isPending, deleteChat, selectedChatId, clearMessages, refreshSessions]
  )

  const handleCompactNow = useCallback(() => {
    if (!sessionContextUsage || isPending || isCompacting) {
      return
    }
    compactContext({
      tokensToCompact: sessionContextUsage.tokensToCompact
    })
      .then((result) => {
        if (!result) {
          return
        }
        toast.success(
          t("knowledge.compactMessage.success", {
            count: result.compactedCount
          })
        )
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error))
      })
  }, [compactContext, isCompacting, isPending, sessionContextUsage, t])

  const handleImageSubmit = useCallback(
    async (prompt: string) => {
      if (!(selectedChatId && activeApiKey)) {
        return
      }

      const userMessageId = `user-img-${Date.now()}`
      const userMessage: KnowledgeChatMessage = {
        id: userMessageId,
        role: "user",
        content: prompt,
        parts: [{ type: "text" as const, text: prompt }],
        timestamp: new Date()
      }

      setMessages((prev) => [...prev, userMessage])

      const images = await generateImage({
        provider: apiProviderId,
        apiKey: activeApiKey,
        baseUrl: activeBaseUrl,
        model: selectedModel,
        prompt
      })

      if (images) {
        const assistantMessageId = `asst-img-${Date.now()}`
        const fileParts = images.map((img) => ({
          type: "file" as const,
          mediaType: img.mediaType,
          url: `data:${img.mediaType};base64,${img.base64}`
        }))

        const assistantMessage: KnowledgeChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          parts: fileParts,
          timestamp: new Date()
        }

        setMessages((prev) => [...prev, assistantMessage])
      }
    },
    [
      selectedChatId,
      activeApiKey,
      apiProviderId,
      activeBaseUrl,
      selectedModel,
      generateImage,
      setMessages
    ]
  )

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const trimmedText = message.text.trim()
      const hasFiles = message.files.length > 0
      if (!(trimmedText || hasFiles) || isPending || !selectedChatId) {
        return
      }

      if (!isApiSupportedProvider(selectedProvider)) {
        toast.error(
          `Provider "${selectedProvider}" is not yet supported by the API`
        )
        return
      }

      mention.close()
      setInputValue("")
      setAttachedNotes([])

      if (isImageMode) {
        handleImageSubmit(trimmedText).catch((error: unknown) => {
          toast.error(getErrorMessage(error))
        })
        return
      }

      const promptText = trimmedText || t("knowledge.attachmentFallback")
      const noteEntryIds = attachedNotes.map((n) => n.id)
      const mentionTitles = attachedNotes.map((n) => n.title)

      sendMessage({
        text: promptText,
        files: message.files,
        noteEntryIds,
        mentionTitles
      })
    },
    [
      isPending,
      selectedChatId,
      selectedProvider,
      isImageMode,
      handleImageSubmit,
      sendMessage,
      t,
      attachedNotes,
      mention.close
    ]
  )

  const handleOpenWebSearchPanel = useCallback<WebSearchPanelOpenHandler>(
    (data) => {
      setWebSearchPanelData(data)
      setWebSearchPanelOpen(true)
    },
    []
  )

  const showWaiting = useMemo(
    () => computeShowWaiting(isPending, messages),
    [isPending, messages]
  )

  const isInputDisabled = isPending || !hasApiKey || !selectedChatId
  const inputPlaceholder = resolveInputPlaceholder(t, hasApiKey, isImageMode)

  const contextPopoverDetails = useMemo(
    () => buildContextPopoverDetails(sessionContextUsage, selectedModel),
    [sessionContextUsage, selectedModel]
  )

  return {
    addToolApprovalResponse,
    attachedNotes,
    catalogModels,
    catalogProviders,
    contextPopoverDetails,
    handleCompactNow,
    handleDeleteChat,
    handleModelChange,
    handleNewChat,
    handleOpenWebSearchPanel,
    handleRemoveNote,
    handleSelectChat,
    handleSubmit,
    handleTextareaChange,
    hasToggleableReasoning,
    imageGenerationEnabled,
    inputPlaceholder,
    inputValue,
    isCompacting,
    isHistoryCollapsed,
    isImageMode,
    isInputDisabled,
    isMobileHistoryOpen,
    isPending,
    isSessionsLoading,
    mention,
    messages,
    selectedChatId,
    selectedModel,
    sessionContextUsage,
    sessions,
    setImageGenerationEnabled,
    setIsHistoryCollapsed,
    setMobileHistoryOpen,
    setThinkingEnabled,
    setWebSearchEnabled,
    setWebSearchPanelOpen,
    showWaiting,
    supportsThinking,
    t,
    textareaRef,
    thinkingActive,
    thinkingEnabled,
    webSearchEnabled,
    webSearchPanelData,
    webSearchPanelOpen
  }
}

interface KnowledgeHeaderBarProps {
  isPending: boolean
  onNewChat: () => void
  onOpenMobileHistory: () => void
  onToggleHistoryCollapsed: () => void
}

function KnowledgeHeaderBar(props: KnowledgeHeaderBarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2">
      <Button
        className="inline-flex gap-2 md:hidden"
        onClick={props.onOpenMobileHistory}
        onFocus={preloadChatHistoryPanel}
        onMouseEnter={preloadChatHistoryPanel}
        size="sm"
        variant="outline"
      >
        <HugeiconsIcon className="size-4" icon={SidebarLeftIcon} />
        <span>{t("knowledge.chatHistory")}</span>
      </Button>
      <Button
        className="hidden gap-2 md:inline-flex"
        onClick={props.onToggleHistoryCollapsed}
        onFocus={preloadChatHistoryPanel}
        onMouseEnter={preloadChatHistoryPanel}
        size="sm"
        variant="outline"
      >
        <HugeiconsIcon className="size-4" icon={SidebarLeftIcon} />
        <span>{t("knowledge.chatHistory")}</span>
      </Button>

      <Button
        className="inline-flex gap-2"
        disabled={props.isPending}
        onClick={props.onNewChat}
        size="sm"
        variant="ghost"
      >
        <HugeiconsIcon className="size-4" icon={MessageAdd01Icon} />
        <span>{t("knowledge.newChat")}</span>
      </Button>
    </div>
  )
}

interface KnowledgeComposerProps {
  attachedNotes: AttachedNote[]
  catalogModels: ReturnType<typeof useAiModelCatalog>["models"]
  catalogProviders: ReturnType<typeof useAiModelCatalog>["providers"]
  contextPopoverDetails: ReturnType<typeof buildContextPopoverDetails>
  hasToggleableReasoning: boolean
  imageGenerationEnabled: boolean
  inputPlaceholder: string
  inputValue: string
  isImageMode: boolean
  isInputDisabled: boolean
  isPending: boolean
  mentionPopoverProps: ReturnType<typeof useMentionPopover>["popoverProps"]
  onImageGenerationToggle: (enabled: boolean) => void
  onModelChange: (modelId: string, providerId?: string) => void
  onRemoveNote: (noteId: string) => void
  onSubmit: (message: PromptInputMessage) => void
  onTextareaChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onThinkingToggle: (enabled: boolean) => void
  onWebSearchToggle: (enabled: boolean) => void
  selectedChatId: string | null
  selectedModel: string
  sessionContextUsage: ReturnType<typeof useSessionContextUsage>
  supportsThinking: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  thinkingActive: boolean
  thinkingEnabled: boolean
  webSearchEnabled: boolean
}

function KnowledgeComposer(props: KnowledgeComposerProps) {
  const { t } = useTranslation()
  return (
    <div className="grid shrink-0 gap-4 pt-4">
      <div className="relative w-full px-4 pb-4">
        <MentionPopover {...props.mentionPopoverProps} />
        <PromptInput
          accept={FILE_ATTACHMENT_ACCEPT}
          globalDrop
          maxFileSize={FILE_ATTACHMENT_MAX_BYTES}
          maxFiles={FILE_ATTACHMENT_MAX_FILES}
          multiple
          onError={(error) => {
            toast.error(error.message)
          }}
          onSubmit={props.onSubmit}
        >
          <AttachmentDisplay />
          {props.attachedNotes.length > 0 && (
            <PromptInputHeader className="flex-wrap gap-2 px-3 pt-2">
              {props.attachedNotes.map((note) => (
                <NoteAttachment
                  key={note.id}
                  note={note}
                  onRemove={props.onRemoveNote}
                />
              ))}
            </PromptInputHeader>
          )}
          <PromptInputBody>
            <PromptInputTextarea
              disabled={props.isInputDisabled}
              onChange={props.onTextareaChange}
              placeholder={props.inputPlaceholder}
              ref={props.textareaRef}
              value={props.inputValue}
            />
          </PromptInputBody>
          <PromptInputFooter className="px-3">
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger
                  aria-label={t("knowledge.addAttachments")}
                  disabled={props.isPending || !props.selectedChatId}
                />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments
                    label={t("knowledge.addAttachments")}
                  />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              <AiModelSelector
                catalogModels={props.catalogModels}
                catalogProviders={props.catalogProviders}
                className="h-8 w-auto gap-2 rounded-lg border-0 px-3 text-xs shadow-none transition-colors duration-200 hover:bg-surface-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                disabled={props.isPending}
                onValueChange={props.onModelChange}
                placeholder={t("knowledge.selectModel")}
                value={props.selectedModel}
              />

              {!props.isImageMode && (
                <WebSearchToggle
                  disabled={props.isPending}
                  enabled={props.webSearchEnabled}
                  onToggle={props.onWebSearchToggle}
                />
              )}

              {!props.isImageMode && (
                <ImageGenerationToggle
                  disabled={props.isPending}
                  enabled={props.imageGenerationEnabled}
                  onToggle={props.onImageGenerationToggle}
                />
              )}

              {!props.isImageMode && props.supportsThinking ? (
                <ThinkingToggle
                  hasToggleableReasoning={props.hasToggleableReasoning}
                  onToggle={props.onThinkingToggle}
                  thinkingActive={props.thinkingActive}
                  thinkingEnabled={props.thinkingEnabled}
                />
              ) : null}

              <Link className="contents" to="/settings/models">
                <PromptInputButton
                  aria-label={t("knowledge.configuration")}
                  variant="ghost"
                >
                  <HugeiconsIcon className="size-4" icon={Setting06Icon} />
                </PromptInputButton>
              </Link>
            </PromptInputTools>

            <div className="flex items-center gap-1">
              {!props.isImageMode && (
                <ContextUsagePopover
                  contextPopoverDetails={props.contextPopoverDetails}
                  selectedModel={props.selectedModel}
                  sessionContextUsage={props.sessionContextUsage}
                />
              )}

              <PromptInputSubmit
                aria-label={t("knowledge.send")}
                className={cn(
                  "transition-colors duration-200 motion-reduce:transition-none",
                  props.isPending
                    ? "animate-pulse motion-reduce:animate-none"
                    : "hover:bg-primary/90"
                )}
                disabled={props.isInputDisabled}
                status={props.isPending ? "submitted" : "ready"}
              />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

function KnowledgePage() {
  const {
    addToolApprovalResponse,
    attachedNotes,
    catalogModels,
    catalogProviders,
    contextPopoverDetails,
    handleCompactNow,
    handleDeleteChat,
    handleModelChange,
    handleNewChat,
    handleOpenWebSearchPanel,
    handleRemoveNote,
    handleSelectChat,
    handleSubmit,
    handleTextareaChange,
    hasToggleableReasoning,
    imageGenerationEnabled,
    inputPlaceholder,
    inputValue,
    isCompacting,
    isHistoryCollapsed,
    isImageMode,
    isInputDisabled,
    isMobileHistoryOpen,
    isPending,
    isSessionsLoading,
    mention,
    messages,
    selectedChatId,
    selectedModel,
    sessionContextUsage,
    sessions,
    setImageGenerationEnabled,
    setIsHistoryCollapsed,
    setMobileHistoryOpen,
    setThinkingEnabled,
    setWebSearchEnabled,
    setWebSearchPanelOpen,
    showWaiting,
    supportsThinking,
    t,
    textareaRef,
    thinkingActive,
    thinkingEnabled,
    webSearchEnabled,
    webSearchPanelData,
    webSearchPanelOpen
  } = useKnowledgePage()

  return (
    <div className="relative flex h-svh overflow-hidden">
      <Sheet onOpenChange={setMobileHistoryOpen} open={isMobileHistoryOpen}>
        <SheetContent
          className="w-[85vw] max-w-[320px] p-0 sm:w-[320px]"
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("knowledge.chatHistory")}</SheetTitle>
          </SheetHeader>
          <ChatHistorySidebar
            className="h-full border-r-0"
            isLoading={isSessionsLoading}
            onDeleteChat={handleDeleteChat}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            selectedChatId={selectedChatId}
            sessions={sessions}
          />
        </SheetContent>
      </Sheet>

      {isHistoryCollapsed ? null : (
        <div className="hidden h-full w-[280px] shrink-0 md:block">
          <ChatHistorySidebar
            className="h-full"
            isLoading={isSessionsLoading}
            onDeleteChat={handleDeleteChat}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            selectedChatId={selectedChatId}
            sessions={sessions}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col divide-y overflow-hidden">
        <KnowledgeHeaderBar
          isPending={isPending}
          onNewChat={handleNewChat}
          onOpenMobileHistory={() => setMobileHistoryOpen(true)}
          onToggleHistoryCollapsed={() => setIsHistoryCollapsed((v) => !v)}
        />

        <div className="flex min-h-0 flex-1 flex-col divide-y overflow-hidden">
          <Conversation>
            <ChatConversationContent
              addToolApprovalResponse={addToolApprovalResponse}
              handleCompactNow={handleCompactNow}
              handleOpenWebSearchPanel={handleOpenWebSearchPanel}
              isCompacting={isCompacting}
              messages={messages}
              sessionContextUsage={sessionContextUsage}
              showWaiting={showWaiting}
              thinkingEnabled={thinkingEnabled}
            />
            <ConversationScrollButton />
          </Conversation>

          <KnowledgeComposer
            attachedNotes={attachedNotes}
            catalogModels={catalogModels}
            catalogProviders={catalogProviders}
            contextPopoverDetails={contextPopoverDetails}
            hasToggleableReasoning={hasToggleableReasoning}
            imageGenerationEnabled={imageGenerationEnabled}
            inputPlaceholder={inputPlaceholder}
            inputValue={inputValue}
            isImageMode={isImageMode}
            isInputDisabled={isInputDisabled}
            isPending={isPending}
            mentionPopoverProps={mention.popoverProps}
            onImageGenerationToggle={setImageGenerationEnabled}
            onModelChange={handleModelChange}
            onRemoveNote={handleRemoveNote}
            onSubmit={handleSubmit}
            onTextareaChange={handleTextareaChange}
            onThinkingToggle={setThinkingEnabled}
            onWebSearchToggle={setWebSearchEnabled}
            selectedChatId={selectedChatId}
            selectedModel={selectedModel}
            sessionContextUsage={sessionContextUsage}
            supportsThinking={supportsThinking}
            textareaRef={textareaRef}
            thinkingActive={thinkingActive}
            thinkingEnabled={thinkingEnabled}
            webSearchEnabled={webSearchEnabled}
          />
        </div>
      </div>

      <WebSearchPanel
        data={webSearchPanelData}
        onOpenChange={setWebSearchPanelOpen}
        open={webSearchPanelOpen}
      />
    </div>
  )
}
