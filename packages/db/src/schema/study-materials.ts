import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique
} from "drizzle-orm/pg-core"

import { user } from "./auth"

/**
 * study_materials - 听读材料（目前只有 YouTube 视频）
 *
 * 一个用户对同一个视频只有一份材料：重新导入字幕会替换它的句子，
 * 保留进度。视频本身永远用官方播放器播放，这里只存链接信息和字幕。
 */
export const studyMaterials = pgTable(
  "study_materials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** youtube；以后的自有音频 / 播客会加别的值 */
    kind: text("kind", { enum: ["youtube"] }).notNull(),
    /** YouTube 视频 id（11 位） */
    sourceRef: text("source_ref").notNull(),
    title: text("title").notNull(),
    channelTitle: text("channel_title"),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds"),
    language: text("language").default("ja").notNull(),
    /** 字幕从哪来：用户上传文件 / 粘贴文本。正式版只有这两种。 */
    captionSource: text("caption_source", {
      enum: ["user_file", "user_paste"]
    }).notNull(),
    captionFileName: text("caption_file_name"),
    segmentCount: integer("segment_count").default(0).notNull(),
    /** 上次听到的句子（0 起），下次打开从这里继续 */
    lastSegmentIndex: integer("last_segment_index").default(0).notNull(),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    unique("study_materials_user_source_unique").on(
      table.userId,
      table.kind,
      table.sourceRef
    ),
    index("study_materials_user_opened_idx").on(
      table.userId,
      table.lastOpenedAt
    ),
    check("study_materials_kind_check", sql`${table.kind} in ('youtube')`),
    check(
      "study_materials_caption_source_check",
      sql`${table.captionSource} in ('user_file', 'user_paste')`
    )
  ]
)

/** study_segments - 材料里按时间轴切好的一句句字幕 */
export const studySegments = pgTable(
  "study_segments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    materialId: text("material_id")
      .notNull()
      .references(() => studyMaterials.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    text: text("text").notNull()
  },
  (table) => [
    unique("study_segments_material_position_unique").on(
      table.materialId,
      table.position
    ),
    check("study_segments_time_check", sql`${table.endMs} > ${table.startMs}`)
  ]
)

export const studyMaterialsRelations = relations(
  studyMaterials,
  ({ one, many }) => ({
    user: one(user, {
      fields: [studyMaterials.userId],
      references: [user.id]
    }),
    segments: many(studySegments)
  })
)

export const studySegmentsRelations = relations(studySegments, ({ one }) => ({
  material: one(studyMaterials, {
    fields: [studySegments.materialId],
    references: [studyMaterials.id]
  })
}))
