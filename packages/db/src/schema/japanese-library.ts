import type { AnalyzedText } from "@folionote/japanese"
import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique
} from "drizzle-orm/pg-core"

import { user } from "./auth"
import { jpVocab } from "./japanese"

export const jpArticles = pgTable(
  "jp_articles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceType: text("source_type", {
      enum: ["paste", "url", "file"]
    }).notNull(),
    sourceUrl: text("source_url"),
    text: text("text").notNull(),
    analysis: jsonb("analysis").$type<{
      chunks: { start: number; end: number; result: AnalyzedText }[]
    }>(),
    engineId: text("engine_id"),
    dictVersion: text("dict_version"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    sentenceCount: integer("sentence_count").notNull().default(0),
    wordCount: integer("word_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    check(
      "jp_articles_source_type_check",
      sql`${table.sourceType} in ('paste', 'url', 'file')`
    ),
    index("jp_articles_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    index("jp_articles_created_at_idx").on(table.createdAt)
  ]
)

export const jpLexicons = pgTable(
  "jp_lexicons",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["book", "deck"] }).notNull(),
    level: text("level", { enum: ["N5", "N4", "N3", "N2", "N1"] }),
    meaningLanguage: text("meaning_language", {
      enum: ["zh", "en", "ja"]
    }).notNull(),
    entryCount: integer("entry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    unique("jp_lexicons_user_name_unique").on(table.userId, table.name),
    check("jp_lexicons_kind_check", sql`${table.kind} in ('book', 'deck')`),
    check(
      "jp_lexicons_level_check",
      sql`${table.level} in ('N5', 'N4', 'N3', 'N2', 'N1')`
    ),
    check(
      "jp_lexicons_meaning_language_check",
      sql`${table.meaningLanguage} in ('zh', 'en', 'ja')`
    )
  ]
)

export const jpLexiconEntries = pgTable(
  "jp_lexicon_entries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    lexiconId: text("lexicon_id")
      .notNull()
      .references(() => jpLexicons.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    headword: text("headword").notNull(),
    reading: text("reading"),
    readingSource: text("reading_source", { enum: ["file", "engine"] }),
    meanings: jsonb("meanings").$type<string[]>().notNull().default([]),
    pos: text("pos"),
    unit: text("unit"),
    baseForm: text("base_form").notNull(),
    vocabId: text("vocab_id").references(() => jpVocab.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    unique("jp_lexicon_entries_word_reading_unique")
      .on(table.lexiconId, table.headword, table.reading)
      .nullsNotDistinct(),
    check(
      "jp_lexicon_entries_reading_source_check",
      sql`${table.readingSource} in ('file', 'engine')`
    ),
    index("jp_lexicon_entries_lexicon_position_idx").on(
      table.lexiconId,
      table.position
    ),
    index("jp_lexicon_entries_base_form_idx").on(table.baseForm),
    index("jp_lexicon_entries_vocab_id_idx").on(table.vocabId)
  ]
)

/**
 * Per-user spaced-repetition state for one study card, created on the first
 * rating. A card is a built-in word, or an imported list entry the word bank
 * could not match (matched entries study as their word, so progress is shared
 * across decks).
 */
export const jpStudyState = pgTable(
  "jp_study_state",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vocabId: text("vocab_id").references(() => jpVocab.id, {
      onDelete: "cascade"
    }),
    lexiconEntryId: integer("lexicon_entry_id").references(
      () => jpLexiconEntries.id,
      { onDelete: "cascade" }
    ),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    intervalDays: integer("interval_days").notNull().default(0),
    ease: real("ease").notNull().default(2.5),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    check(
      "jp_study_state_one_card_check",
      sql`(${table.vocabId} is null) <> (${table.lexiconEntryId} is null)`
    ),
    unique("jp_study_state_user_vocab_unique").on(table.userId, table.vocabId),
    unique("jp_study_state_user_entry_unique").on(
      table.userId,
      table.lexiconEntryId
    ),
    index("jp_study_state_user_due_idx").on(table.userId, table.dueAt)
  ]
)

export const jpArticlesRelations = relations(jpArticles, ({ one }) => ({
  user: one(user, { fields: [jpArticles.userId], references: [user.id] })
}))
export const jpLexiconsRelations = relations(jpLexicons, ({ one, many }) => ({
  user: one(user, { fields: [jpLexicons.userId], references: [user.id] }),
  entries: many(jpLexiconEntries)
}))
export const jpLexiconEntriesRelations = relations(
  jpLexiconEntries,
  ({ one }) => ({
    lexicon: one(jpLexicons, {
      fields: [jpLexiconEntries.lexiconId],
      references: [jpLexicons.id]
    }),
    vocab: one(jpVocab, {
      fields: [jpLexiconEntries.vocabId],
      references: [jpVocab.id]
    })
  })
)
