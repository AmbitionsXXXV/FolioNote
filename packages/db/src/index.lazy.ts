// Browser-safe stub: db is server-only, accessing any property throws at runtime.
export {
  entryExternalLinks,
  entryExternalLinksRelations,
  externalConnections,
  externalConnectionsRelations
} from "./schema/connections"
export {
  jpArticles,
  jpArticlesRelations,
  jpLexicons,
  jpLexiconsRelations,
  jpLexiconEntries,
  jpLexiconEntriesRelations
} from "./schema/japanese-library"
// The type import below is erased at compile time and produces no runtime code.
type DbType = ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>

export const db = new Proxy({} as DbType, {
  get(_target, prop) {
    throw new Error(
      `Cannot access db.${String(prop)} on the client. Database operations are server-only.`
    )
  }
}) as DbType

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
  entryCollaborators,
  entryCollaboratorsRelations,
  entryReviewState,
  entryReviewStateRelations,
  entryShares,
  entrySharesRelations,
  entrySources,
  entrySourcesRelations,
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
