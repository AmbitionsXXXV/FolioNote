import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core"

export const jpVocab = pgTable(
  "jp_vocab",
  {
    id: text("id").primaryKey(),
    word: text("word").notNull(),
    reading: text("reading").notNull(),
    romaji: text("romaji").notNull(),
    meaningsEn: jsonb("meanings_en").$type<string[]>().notNull(),
    meaningsZh: jsonb("meanings_zh").$type<string[]>(),
    level: text("level", { enum: ["N5", "N4", "N3", "N2", "N1"] }).notNull(),
    jmdictPos: jsonb("jmdict_pos").$type<string[]>().notNull().default([]),
    jmdictId: integer("jmdict_id"),
    otherForms: jsonb("other_forms").$type<string[]>().notNull().default([]),
    otherReadings: jsonb("other_readings")
      .$type<string[]>()
      .notNull()
      .default([]),
    source: text("source").notNull().default("openjlpt"),
    sourceVersion: text("source_version").notNull(),
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
      "jp_vocab_level_check",
      sql`${table.level} in ('N5', 'N4', 'N3', 'N2', 'N1')`
    ),
    index("jp_vocab_word_idx").on(table.word),
    index("jp_vocab_reading_idx").on(table.reading),
    index("jp_vocab_romaji_idx").on(table.romaji),
    index("jp_vocab_level_idx").on(table.level),
    index("jp_vocab_jmdict_id_idx").on(table.jmdictId)
  ]
)

export const jpVocabExamples = pgTable(
  "jp_vocab_examples",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    vocabId: text("vocab_id")
      .notNull()
      .references(() => jpVocab.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    ja: text("ja").notNull(),
    furigana: text("furigana"),
    en: text("en").notNull(),
    tatoebaId: integer("tatoeba_id")
  },
  (table) => [
    uniqueIndex("jp_vocab_examples_vocab_id_position_idx").on(
      table.vocabId,
      table.position
    )
  ]
)

export const jpKanji = pgTable(
  "jp_kanji",
  {
    character: text("character").primaryKey(),
    level: text("level", { enum: ["N5", "N4", "N3", "N2", "N1"] }).notNull(),
    strokes: integer("strokes"),
    grade: integer("grade"),
    freq: integer("freq"),
    radical: text("radical"),
    radicalNumber: integer("radical_number"),
    onyomi: jsonb("onyomi").$type<string[]>().notNull(),
    kunyomi: jsonb("kunyomi").$type<string[]>().notNull(),
    nanori: jsonb("nanori").$type<string[]>().notNull().default([]),
    meaningsEn: jsonb("meanings_en").$type<string[]>().notNull(),
    words: jsonb("words").$type<string[]>().notNull().default([]),
    supplementary: boolean("supplementary").notNull().default(false),
    sourceVersion: text("source_version").notNull(),
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
      "jp_kanji_level_check",
      sql`${table.level} in ('N5', 'N4', 'N3', 'N2', 'N1')`
    ),
    index("jp_kanji_level_idx").on(table.level)
  ]
)

export const jpGrammar = pgTable(
  "jp_grammar",
  {
    id: text("id").primaryKey(),
    pattern: text("pattern").notNull(),
    reading: text("reading"),
    romaji: text("romaji").notNull(),
    level: text("level", { enum: ["N5", "N4", "N3", "N2", "N1"] }).notNull(),
    meaning: text("meaning").notNull(),
    formation: text("formation").notNull(),
    examples: jsonb("examples")
      .$type<{ ja: string; furigana?: string; en: string }[]>()
      .notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    notes: text("notes"),
    sourceVersion: text("source_version").notNull(),
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
      "jp_grammar_level_check",
      sql`${table.level} in ('N5', 'N4', 'N3', 'N2', 'N1')`
    ),
    index("jp_grammar_level_idx").on(table.level),
    index("jp_grammar_pattern_idx").on(table.pattern)
  ]
)

export const jpVocabRelations = relations(jpVocab, ({ many }) => ({
  examples: many(jpVocabExamples)
}))

export const jpVocabExamplesRelations = relations(
  jpVocabExamples,
  ({ one }) => ({
    vocab: one(jpVocab, {
      fields: [jpVocabExamples.vocabId],
      references: [jpVocab.id]
    })
  })
)
