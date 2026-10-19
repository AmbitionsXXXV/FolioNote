import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

import { kanaToRomaji } from "@folionote/japanese"
import { z } from "zod"

import type { VocabSourceDetails } from "../src/schema/japanese"

const text = z.string().trim().min(1)
const pageSchema = z.object({
  result: z.object({
    code: z.literal(200),
    fid: text,
    pageIndex: z.int().positive(),
    totalPage: z.int().positive(),
    size: z.int().positive(),
    "1000": z.array(z.object({ objectId: text, title: text })),
    result: z
      .array(
        z.object({
          targetId: text,
          target: z.object({
            objectId: text,
            spell: text,
            pron: text,
            excerpt: text,
            accent: z.string().optional(),
            romaji_hepburn: z.string().optional(),
            romaji: z.string().optional(),
            tags: z.string().optional(),
            updatedAt: z.iso.datetime()
          })
        })
      )
      .min(1)
  })
})

const posPrefix = /^\[([^\]]+)\]\s*/u
const whitespace = /\s+/gu
const kana = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u
const numericFilename = /^\d+\.json$/u
const levels = ["N5", "N4", "N3", "N2", "N1"] as const
// Reviewed against this export. Other glosses include Chinese with Japanese
// quotations; kana detection alone would misclassify those as Japanese.
const japaneseGlossIds = new Set([
  "zfJG8FqFbC",
  "220120w151838",
  "220120w132756",
  "hnxq9EqCVs"
])

export interface CleanEntry {
  id: string
  word: string
  reading: string
  romaji: string
  meaningsEn: string[]
  meaningsZh: string[]
  meaningsJa: string[]
  pitchAccents: number[]
  level: (typeof levels)[number]
  sourceDetails: VocabSourceDetails
}

export interface CleanData {
  formatVersion: 1
  source: "moji"
  sourceVersion: string
  collection: {
    id: string
    title: string
    level: "N5"
    total: number
    pages: number
  }
  files: { name: string; sha256: string; page: number; count: number }[]
  entries: CleanEntry[]
  issues: { id: string; word: string; message: string }[]
}

export function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function parseAccents(value: string): number[] {
  const digits = [...value.replace(whitespace, "")].map((char) => {
    const index = "⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳".indexOf(char)
    if (index === -1) throw new Error(`Unsupported accent notation: ${value}`)
    return index
  })
  return [...new Set(digits)].toSorted((a, b) => a - b)
}

export async function cleanMoji(directory: string): Promise<CleanData> {
  const filenames = await readdir(directory)
  const names = filenames
    .filter((name) => numericFilename.test(name))
    .toSorted((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
  if (names.length === 0) throw new Error("No numbered JSON pages found")
  const pages = await Promise.all(
    names.map(async (name) => {
      const raw = await readFile(join(directory, name), "utf-8")
      try {
        return {
          name,
          sha256: hash(raw),
          ...pageSchema.parse(JSON.parse(raw)).result
        }
      } catch {
        // Do not echo validation input: the envelope can contain credentials.
        throw new Error(`Invalid or empty MOJi page: ${name}`)
      }
    })
  )
  const first = pages[0]
  if (!first) throw new Error("No pages parsed")
  const collectionTitle = first["1000"].find(
    (folder) => folder.objectId === first.fid
  )?.title
  if (!collectionTitle) throw new Error("Missing collection title")
  const pageNumbers = new Set(pages.map((page) => page.pageIndex))
  if (
    pages.length !== first.totalPage ||
    pageNumbers.size !== first.totalPage ||
    pages.some(
      (page) =>
        page.fid !== first.fid ||
        page.size !== first.size ||
        page.totalPage !== first.totalPage ||
        page.pageIndex > first.totalPage
    )
  ) {
    throw new Error("Incomplete, duplicated, or inconsistent pages")
  }
  if (pages.reduce((sum, page) => sum + page.result.length, 0) !== first.size) {
    throw new Error("Row count does not match the collection's declared size")
  }
  pages.sort((a, b) => a.pageIndex - b.pageIndex)
  const entries: CleanEntry[] = []
  const issues: CleanData["issues"] = []
  const byId = new Map<string, CleanEntry>()
  const byWord = new Map<string, string>()
  for (const page of pages) {
    for (const [position, item] of page.result.entries()) {
      const target = item.target
      const id = `moji:${target.objectId}`
      const word = target.spell.normalize("NFC")
      const reading = target.pron.normalize("NFKC").replace(whitespace, "")
      if (item.targetId !== target.objectId || !kana.test(reading)) {
        throw new Error(`Invalid source ID or kana reading: ${id}`)
      }
      const romaji = kanaToRomaji(reading)
      const sourceRomaji = target.romaji_hepburn ?? target.romaji ?? ""
      const tags = [
        ...new Set(
          (target.tags ?? "")
            .split("#")
            .map((tag) => tag.trim())
            .filter(Boolean)
        )
      ]
      const level = levels.find((candidate) => tags.includes(candidate)) ?? "N5"
      const partOfSpeech = target.excerpt.match(posPrefix)?.[1] ?? ""
      const gloss = target.excerpt.replace(posPrefix, "").trim()
      if (!gloss) throw new Error(`Empty meaning: ${id}`)
      const meanings = [
        ...new Set(
          gloss
            .split(/[；;]/u)
            .map((meaning) => meaning.trim())
            .filter(Boolean)
        )
      ]
      const isJapanese = japaneseGlossIds.has(target.objectId)
      const entry: CleanEntry = {
        id,
        word,
        reading,
        romaji,
        meaningsEn: [],
        meaningsZh: isJapanese ? [] : meanings,
        meaningsJa: isJapanese ? meanings : [],
        pitchAccents: parseAccents(target.accent ?? ""),
        level,
        sourceDetails: {
          moji: {
            entryId: target.objectId,
            updatedAt: target.updatedAt,
            collectionId: first.fid,
            collectionTitle,
            page: page.pageIndex,
            position: position + 1,
            tags,
            partOfSpeech,
            excerpt: target.excerpt,
            reading: target.pron,
            romaji: sourceRomaji,
            accent: target.accent ?? ""
          }
        }
      }
      const issue = (message: string) => issues.push({ id, word, message })
      if (reading !== target.pron)
        issue(`Normalized reading: ${target.pron} → ${reading}`)
      if (romaji !== sourceRomaji)
        issue(`Kana-derived romaji: ${sourceRomaji || "(missing)"} → ${romaji}`)
      if (isJapanese)
        issue(
          "Japanese-only definition; no Chinese/English translation invented"
        )
      if (target.objectId === "220120w151838")
        issue(
          "Source defines 'having three eyes'; do not reinterpret as 'third'"
        )
      if (level !== "N5")
        issue(`Collection is N5; source tags suggest ${level}`)
      if (!tags.some((tag) => levels.includes(tag as CleanEntry["level"])))
        issue("No JLPT tag; N5 inferred from user-provided collection")
      const prior = byId.get(id)
      if (prior) {
        const { sourceDetails: _before, ...before } = prior
        const { sourceDetails: _after, ...after } = entry
        if (JSON.stringify(before) !== JSON.stringify(after))
          throw new Error(`Conflicting duplicate ID: ${id}`)
        issue("Duplicate source entry skipped")
        continue
      }
      const key = JSON.stringify([word, reading])
      if (byWord.has(key))
        throw new Error(
          `Multiple source IDs for ${word}/${reading}; review before merging`
        )
      byId.set(id, entry)
      byWord.set(key, id)
      entries.push(entry)
    }
  }
  return {
    formatVersion: 1,
    source: "moji",
    sourceVersion: hash(JSON.stringify(entries)),
    collection: {
      id: first.fid,
      title: collectionTitle,
      level: "N5",
      total: first.size,
      pages: first.totalPage
    },
    files: pages.map((page) => ({
      name: page.name,
      sha256: page.sha256,
      page: page.pageIndex,
      count: page.result.length
    })),
    entries,
    issues
  }
}
