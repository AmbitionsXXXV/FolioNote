import { db, studyMaterials, studySegments } from "@folionote/db"
import { parseSubtitles } from "@folionote/utils/subtitles"
import { parseYouTubeVideoId } from "@folionote/utils/youtube"
import { ORPCError } from "@orpc/server"
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import type { YouTubeVideoInfo } from "../connectors/youtube"
import {
  fetchYouTubeVideoInfo,
  YouTubeVideoNotFoundError
} from "../connectors/youtube"
import { protectedProcedure } from "../index"
import { recordLearningActivity } from "../utils/learning-activity"
import { TimeZoneSchema } from "../utils/time-zone-schema"

// A two-hour SRT is ~150 KB; the cap only stops obviously wrong uploads.
const MAX_CAPTION_CHARS = 2_000_000
const MAX_SEGMENTS = 5000
// Postgres caps bind parameters per statement; 5 columns × 1000 rows stays well under.
const SEGMENT_INSERT_BATCH = 1000

const IdInput = z.object({ id: z.string().min(1).max(64) })

const CreateInput = z.object({
  url: z.string().trim().min(1).max(2048),
  captions: z.object({
    text: z.string().min(1).max(MAX_CAPTION_CHARS),
    fileName: z.string().trim().min(1).max(255).optional()
  })
})

const ProgressInput = IdInput.extend({
  segmentIndex: z.number().int().min(0),
  /** True once playback reaches the last line; recorded once per material. */
  completed: z.boolean().optional(),
  timeZone: TimeZoneSchema
})

const materialColumns = {
  id: studyMaterials.id,
  kind: studyMaterials.kind,
  sourceRef: studyMaterials.sourceRef,
  title: studyMaterials.title,
  channelTitle: studyMaterials.channelTitle,
  thumbnailUrl: studyMaterials.thumbnailUrl,
  durationSeconds: studyMaterials.durationSeconds,
  captionSource: studyMaterials.captionSource,
  captionFileName: studyMaterials.captionFileName,
  segmentCount: studyMaterials.segmentCount,
  lastSegmentIndex: studyMaterials.lastSegmentIndex,
  lastOpenedAt: studyMaterials.lastOpenedAt,
  completedAt: studyMaterials.completedAt,
  createdAt: studyMaterials.createdAt
}

const ownedMaterialWhere = (id: string, userId: string) =>
  and(eq(studyMaterials.id, id), eq(studyMaterials.userId, userId))

/**
 * Video details for a new material. A YouTube outage shouldn't block someone
 * who already has the link and the captions, so we fall back to a bare title.
 */
async function videoDetails(videoId: string) {
  let info: YouTubeVideoInfo | null = null
  try {
    info = await fetchYouTubeVideoInfo(videoId)
  } catch (error) {
    if (error instanceof YouTubeVideoNotFoundError) {
      throw new ORPCError("NOT_FOUND", { message: error.message })
    }
  }
  if (info?.embeddable === false) {
    throw new ORPCError("BAD_REQUEST", {
      message: "The owner doesn't allow this video to be embedded"
    })
  }
  return {
    title: info?.title ?? `YouTube ${videoId}`,
    channelTitle: info?.channelTitle ?? null,
    thumbnailUrl: info?.thumbnailUrl ?? null,
    durationSeconds: info?.durationSeconds ?? null
  }
}

/**
 * listening.create - Add a YouTube video with the caller's own SRT/VTT.
 * Adding the same video again replaces its captions and keeps the progress
 * (clamped to the new line count).
 */
const createMaterial = protectedProcedure
  .input(CreateInput)
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const videoId = parseYouTubeVideoId(input.url)
    if (!videoId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Not a YouTube video link"
      })
    }
    const cues = parseSubtitles(input.captions.text)
    if (cues.length === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No timed caption lines found (expected SRT or VTT)"
      })
    }
    if (cues.length > MAX_SEGMENTS) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Captions have more than ${MAX_SEGMENTS} lines`
      })
    }
    const details = await videoDetails(videoId)
    const captionFileName = input.captions.fileName ?? null
    const captionSource = captionFileName ? "user_file" : "user_paste"

    return db.transaction(async (tx) => {
      const [material] = await tx
        .insert(studyMaterials)
        .values({
          id: nanoid(),
          userId,
          kind: "youtube",
          sourceRef: videoId,
          ...details,
          captionSource,
          captionFileName,
          segmentCount: cues.length
        })
        .onConflictDoUpdate({
          target: [
            studyMaterials.userId,
            studyMaterials.kind,
            studyMaterials.sourceRef
          ],
          set: {
            ...details,
            captionSource,
            captionFileName,
            segmentCount: cues.length,
            lastSegmentIndex: sql`least(${studyMaterials.lastSegmentIndex}, ${cues.length - 1})`
          }
        })
        .returning({ id: studyMaterials.id })
      if (!material) throw new Error("Material upsert returned no row")

      await tx
        .delete(studySegments)
        .where(eq(studySegments.materialId, material.id))
      for (let start = 0; start < cues.length; start += SEGMENT_INSERT_BATCH) {
        await tx.insert(studySegments).values(
          cues.slice(start, start + SEGMENT_INSERT_BATCH).map((cue) => ({
            materialId: material.id,
            position: cue.index,
            startMs: cue.startMs,
            endMs: cue.endMs,
            text: cue.text
          }))
        )
      }
      return { id: material.id, segmentCount: cues.length }
    })
  })

/** listening.list - The caller's materials, most recently opened first. */
const listMaterials = protectedProcedure.handler(({ context }) =>
  db
    .select(materialColumns)
    .from(studyMaterials)
    .where(eq(studyMaterials.userId, context.session.user.id))
    .orderBy(
      sql`${studyMaterials.lastOpenedAt} desc nulls last`,
      desc(studyMaterials.createdAt)
    )
)

/** listening.get - One material with all its caption lines. */
const getMaterial = protectedProcedure
  .input(IdInput)
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const [material] = await db
      .select(materialColumns)
      .from(studyMaterials)
      .where(ownedMaterialWhere(input.id, userId))
      .limit(1)
    if (!material) {
      throw new ORPCError("NOT_FOUND", { message: "Material not found" })
    }
    const segments = await db
      .select({
        position: studySegments.position,
        startMs: studySegments.startMs,
        endMs: studySegments.endMs,
        text: studySegments.text
      })
      .from(studySegments)
      .where(eq(studySegments.materialId, material.id))
      .orderBy(asc(studySegments.position))
    return { material, segments }
  })

/**
 * listening.progress - Remember the current line; the first time the last
 * line is reached, count it as a finished video for the streak.
 */
const saveProgress = protectedProcedure
  .input(ProgressInput)
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id
    const now = new Date()
    const [material] = await db
      .update(studyMaterials)
      .set({
        lastSegmentIndex: sql`least(${input.segmentIndex}, greatest(${studyMaterials.segmentCount} - 1, 0))`,
        lastOpenedAt: now
      })
      .where(ownedMaterialWhere(input.id, userId))
      .returning({ id: studyMaterials.id, title: studyMaterials.title })
    if (!material) {
      throw new ORPCError("NOT_FOUND", { message: "Material not found" })
    }
    if (!input.completed) return { progress: null }

    // Only the update that flips completed_at from null records the activity,
    // so replays and two open tabs can't double-count.
    const [finished] = await db
      .update(studyMaterials)
      .set({ completedAt: now })
      .where(
        and(
          ownedMaterialWhere(input.id, userId),
          isNull(studyMaterials.completedAt)
        )
      )
      .returning({ id: studyMaterials.id })
    if (!finished) return { progress: null }
    const progress = await recordLearningActivity(db, {
      userId,
      kind: "listen_complete",
      refId: material.id,
      language: "ja",
      meta: { title: material.title },
      occurredAt: now,
      timeZone: input.timeZone
    })
    return { progress }
  })

/** listening.remove - Delete a material and its lines (notebook words keep their sentence). */
const removeMaterial = protectedProcedure
  .input(IdInput)
  .handler(async ({ input, context }) => {
    const [removed] = await db
      .delete(studyMaterials)
      .where(ownedMaterialWhere(input.id, context.session.user.id))
      .returning({ id: studyMaterials.id })
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Material not found" })
    }
    return removed
  })

export const listeningRouter = {
  create: createMaterial,
  list: listMaterials,
  get: getMaterial,
  progress: saveProgress,
  remove: removeMaterial
}
