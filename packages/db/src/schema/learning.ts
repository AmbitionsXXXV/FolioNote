import { relations } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp
} from "drizzle-orm/pg-core"

import { user } from "./auth"

/**
 * learning_activities - 学习行为事件流（打卡、每日目标、学习记录的唯一来源）
 *
 * 每次复习/学新词/记笔记/读文章都写一行。id 允许客户端生成，
 * 这样离线写入在补传时可以按主键去重。
 */
export const learningActivities = pgTable(
  "learning_activities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** entry_review | vocab_review | vocab_new | entry_create | article_read | exam_complete */
    kind: text("kind").notNull(),
    /** 关联对象 id（条目 / 单词 / 文章），仅用于展示明细 */
    refId: text("ref_id"),
    /** ja | en；与语言无关的活动为空 */
    language: text("language"),
    points: integer("points").notNull(),
    /** 用户本地日期 YYYY-MM-DD（已按 day_start_hour 切日） */
    localDate: text("local_date").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /** 明细展示用的少量冗余信息（标题、评分等） */
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("learning_activities_user_date_idx").on(table.userId, table.localDate)
  ]
)

export const learningActivitiesRelations = relations(
  learningActivities,
  ({ one }) => ({
    user: one(user, {
      fields: [learningActivities.userId],
      references: [user.id]
    })
  })
)

/**
 * user_streaks - 连续打卡快照 + 打卡设置（每个用户一行）
 *
 * 快照只在当天第一次学习时推进，读取时不必扫描历史事件。
 */
export const userStreaks = pgTable("user_streaks", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  currentDays: integer("current_days").default(0).notNull(),
  longestDays: integer("longest_days").default(0).notNull(),
  /** 当前连续开始的本地日期 */
  startedOn: text("started_on"),
  /** 最近一次学习的本地日期 */
  lastActiveOn: text("last_active_on"),
  /** 补签卡数量（0–2） */
  freezes: integer("freezes").default(0).notNull(),
  /** IANA 时区，例如 Asia/Shanghai */
  timezone: text("timezone").default("UTC").notNull(),
  /** 一天从几点开始算（默认凌晨 4 点，熬夜学习仍算前一天） */
  dayStartHour: integer("day_start_hour").default(4).notNull(),
  dailyGoal: integer("daily_goal").default(20).notNull(),
  /** 提醒时间 HH:mm；为空表示不提醒 */
  remindAt: text("remind_at"),
  /** 正在学的语言 */
  languages: text("languages").array().default(["ja"]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

export const userStreaksRelations = relations(userStreaks, ({ one }) => ({
  user: one(user, {
    fields: [userStreaks.userId],
    references: [user.id]
  })
}))

/**
 * user_milestones - 已达成的连续天数里程碑（只记一次）
 */
export const userMilestones = pgTable(
  "user_milestones",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 例如 streak_7 */
    key: text("key").notNull(),
    achievedOn: text("achieved_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
)

export const userMilestonesRelations = relations(userMilestones, ({ one }) => ({
  user: one(user, {
    fields: [userMilestones.userId],
    references: [user.id]
  })
}))
