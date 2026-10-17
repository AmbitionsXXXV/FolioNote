// Auth schema

// AI schema
import {
  aiCatalogSync,
  aiChatSessions,
  aiChatSessionsRelations,
  aiModels,
  aiModelsRelations,
  aiProviders,
  aiProvidersRelations,
  userAiModelSettings,
  userAiModelSettingsRelations,
  userAiProviderSettings,
  userAiProviderSettingsRelations
} from "./schema/ai"
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification
} from "./schema/auth"
import {
  attachments,
  attachmentsRelations,
  dailyLogs,
  dailyLogsRelations,
  entries,
  entriesRelations,
  entryChunks,
  entryChunksRelations,
  entryCollaborators,
  entryCollaboratorsRelations,
  entryReviewState,
  entryReviewStateRelations,
  entryShares,
  entrySharesRelations,
  entrySources,
  entrySourcesRelations,
  entrySyncState,
  entrySyncStateRelations,
  entryTags,
  entryTagsRelations,
  reviewEvents,
  reviewEventsRelations,
  searchHistory,
  searchHistoryRelations,
  sources,
  sourcesRelations,
  tags,
  tagsRelations
} from "./schema/entries"
// Business schema
import { entryLinks, entryLinksRelations } from "./schema/graph"
import {
  jpGrammar,
  jpKanji,
  jpVocab,
  jpVocabExamples,
  jpVocabExamplesRelations,
  jpVocabRelations
} from "./schema/japanese"
// Schema configuration for drizzle
import {
  jpArticles,
  jpArticlesRelations,
  jpLexicons,
  jpLexiconsRelations,
  jpLexiconEntries,
  jpLexiconEntriesRelations
} from "./schema/japanese-library"

export {
  jpArticles,
  jpArticlesRelations,
  jpLexicons,
  jpLexiconsRelations,
  jpLexiconEntries,
  jpLexiconEntriesRelations
} from "./schema/japanese-library"

const schema = {
  jpArticles,
  jpArticlesRelations,
  jpLexicons,
  jpLexiconsRelations,
  jpLexiconEntries,
  jpLexiconEntriesRelations,
  // Japanese word bank
  jpGrammar,
  jpKanji,
  jpVocab,
  jpVocabExamples,
  jpVocabExamplesRelations,
  jpVocabRelations,
  // Auth
  user,
  userRelations,
  session,
  sessionRelations,
  account,
  accountRelations,
  verification,
  // Business
  entries,
  entriesRelations,
  tags,
  tagsRelations,
  entryTags,
  entryTagsRelations,
  sources,
  sourcesRelations,
  entrySources,
  entrySourcesRelations,
  attachments,
  attachmentsRelations,
  reviewEvents,
  reviewEventsRelations,
  entryReviewState,
  entryReviewStateRelations,
  dailyLogs,
  dailyLogsRelations,
  entryShares,
  entrySharesRelations,
  entryChunks,
  entryChunksRelations,
  entryCollaborators,
  entryCollaboratorsRelations,
  entrySyncState,
  entrySyncStateRelations,
  searchHistory,
  searchHistoryRelations,
  // Graph
  entryLinks,
  entryLinksRelations,
  // AI
  userAiModelSettings,
  userAiModelSettingsRelations,
  userAiProviderSettings,
  userAiProviderSettingsRelations,
  aiChatSessions,
  aiChatSessionsRelations,
  aiProviders,
  aiProvidersRelations,
  aiModels,
  aiModelsRelations,
  aiCatalogSync
}

// 数据库连接初始化
import { drizzle } from "drizzle-orm/node-postgres"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

// 显式标注:TS7 对不可移植的推断类型(引用非直接依赖 @types/pg 的
// Pool)报 TS2883,标注后无需依赖推断
export const db: NodePgDatabase<typeof schema> = drizzle(
  process.env.DATABASE_URL || "",
  { schema }
)

export {
  aiCatalogSync,
  aiChatSessions,
  aiChatSessionsRelations,
  aiModels,
  aiModelsRelations,
  aiProviders,
  aiProvidersRelations,
  userAiModelSettings,
  userAiModelSettingsRelations,
  userAiProviderSettings,
  userAiProviderSettingsRelations
} from "./schema/ai"
// Re-export schema for external use
export {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification
} from "./schema/auth"
export {
  attachments,
  attachmentsRelations,
  dailyLogs,
  dailyLogsRelations,
  entries,
  entriesRelations,
  entryChunks,
  entryChunksRelations,
  entryCollaborators,
  entryCollaboratorsRelations,
  entryReviewState,
  entryReviewStateRelations,
  entryShares,
  entrySharesRelations,
  entrySources,
  entrySourcesRelations,
  entrySyncState,
  entrySyncStateRelations,
  entryTags,
  entryTagsRelations,
  reviewEvents,
  reviewEventsRelations,
  searchHistory,
  searchHistoryRelations,
  sources,
  sourcesRelations,
  tags,
  tagsRelations
} from "./schema/entries"
export { entryLinks, entryLinksRelations } from "./schema/graph"
export {
  jpGrammar,
  jpKanji,
  jpVocab,
  jpVocabExamples,
  jpVocabExamplesRelations,
  jpVocabRelations
} from "./schema/japanese"
