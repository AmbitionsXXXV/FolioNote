-- 把 0004 手写的 search_vector 生成列和两个索引纳入 Drizzle schema 管理。
-- 已经跑过 0004 的库（生产、旧的本地库）里这些对象已存在，所以全部 IF NOT EXISTS，
-- 迁移在新库和老库上都能幂等执行。
ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(content_text, ''::text)))) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_search_vector_idx" ON "entries" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_user_id_updated_at_not_deleted_idx" ON "entries" USING btree ("user_id","updated_at" DESC NULLS LAST) WHERE deleted_at IS NULL;
