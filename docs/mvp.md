
# FolioNote MVP v2 Scope（基于当前实现进度扩展）

## 概述

FolioNote 是一个个人知识管理应用，帮助用户完成“捕获 → 组织 → 复习”的闭环。  
在 MVP v1 已完成 Web 端核心功能（Entries/Tags/Sources/Search/Review 基础规则）的基础上，MVP v2 聚焦三件事：

* 编辑体验升级：Tiptap 深度集成（尤其 `/` 命令）
* 复习系统升级：从规则队列 → 可调度的间隔复习（支持评分、到期队列）
* 移动端（仅 iOS）落地：在 RN 无 DOM 的约束下完成富文本处理与跨端同步闭环

---

## 当前完成情况（截至现在）

### 已完成（Done）

#### 1) 用户认证

* [x] 邮箱/密码注册与登录
* [x] 会话持久化
* [x] 跨平台认证 (Web + Native)

#### 2) 条目管理 (Entries)

* [x] 创建学习笔记条目
* [x] 编辑条目（Web 端基于 Tiptap）
* [x] 删除条目（软删除）
* [x] 条目列表与筛选
* [x] 收件箱（Inbox）功能

Done: 实现了 entries API router（CRUD + 列表筛选 + 游标分页），以及 Web 端的收件箱页面、资料库页面、条目编辑器（基于 Tiptap）和快速捕获组件。

#### 3) 标签系统 (Tags)

* [x] 创建/编辑/删除标签
* [x] 为条目添加/移除标签
* [x] 按标签筛选条目

Done: 完整 tags API router（CRUD + 列表）与 entries router 扩展（addTag/removeTag/getTags + tagId 筛选），包含单元测试。

#### 4) 来源管理 (Sources)

* [x] 创建来源（链接/书籍/文章）
* [x] 关联条目与来源
* [x] 来源列表页面

Done: 完整 sources API router（CRUD + 列表 + 分页）与 entry-source 关联 API，包含单元测试。Web 端来源列表支持筛选与增删改。

#### 5) 基础搜索

* [x] 关键词搜索（标题/内容）
* [x] 搜索结果展示

Done: search API router（ILIKE 模糊搜索 + 游标分页）与 Web 搜索页面，包含单元测试。

#### 6) 复习工作流（基础版）

* [x] “今日复习”队列
* [x] 标记条目为“已复习”
* [x] 简单复习规则（new/starred/unreviewed/all）

Done: review API router（getQueue/markReviewed/history/todayStats/reviewCount），包含单元测试。Web 端复习页支持四种模式与统计。

---

## MVP v2 范围内（In Scope）

### A. 编辑体验升级（Web）

#### A1. Tiptap `/` Command（Slash Menu）

* [x] 输入 `/` 弹出命令菜单（支持搜索过滤、上下选择、回车执行、Esc 关闭）
* [x] 基础命令集（第一版）
  * [x] 标题：`/h1` `/h2` `/h3`
  * [x] 引用：`/quote`
  * [x] 代码块：`/code`
  * [x] 列表：`/bullet` `/ordered`
  * [x] 分割线：`/divider`
* [x] FolioNote 相关命令（至少落地 1 个）
  * [x] `/tag`：搜索并插入/绑定标签
  * [x] `/source`：搜索并插入/关联来源
  * [x] `/ref`：插入条目引用（可先生成可点击的内部链接）

Done: 实现了完整的 Tiptap Slash Command 扩展：

* 基础命令：标题（H1/H2/H3）、引用、代码块（Shiki 语法高亮）、无序/有序列表、分割线
* FolioNote 命令：`/tag` 快速添加标签、`/source` 关联来源、`/ref` 插入条目引用链接
* 交互特性：键盘导航（上下箭头、回车确认、Esc 关闭）、搜索过滤、分组显示
* 新增组件：EntrySources（来源管理）、EntryPicker（条目选择器）

验收标准：

* Slash Menu 在连续输入、撤销/重做、快速切换光标时稳定可用
* 执行命令后光标位置正确，不出现“命令文字残留”
* 异步命令（如 tag/source/ref）支持防抖搜索，结果展示与选择稳定

#### A2. 富文本内容存储策略（跨端一致性）

目标：为 iOS WebView 编辑器与搜索/预览/复习提供统一数据基础，降低格式漂移与转换成本。

* [x] 内容主存为 ProseMirror JSON（Tiptap doc）
* [x] 派生字段（用于搜索/列表/复习摘要）
  * [x] `content_text`：纯文本（用于 ILIKE 搜索与摘要）
  * [x] 可选：`content_preview`（截断预览）- 通过 `generateContentPreview` 工具函数实现
* [x] 迁移与兼容
  * [x] 现有 Markdown/字符串内容迁移到 JSON 或保持兼容读取策略
  * [x] API 返回中提供 `content.json` 与 `content.text`（或等价结构）

Done - 实现说明：

1. 数据库 Schema 新增 `contentJson`（ProseMirror JSON）和 `contentText`（纯文本）字段
2. API 层自动处理内容转换：优先使用 `contentJson`，向后兼容 `content`（HTML）
3. 前端编辑器支持 JSON 格式存储，onChange 同时返回 HTML 和 JSON
4. EntryCard 优先使用 `contentText` 进行预览显示
5. 内容转换工具函数位于 `packages/api/src/utils/content.ts`

验收标准：

* Web 端编辑、列表展示、搜索、复习均使用同一套“主存 + 派生字段”逻辑
* 任意条目内容不会因保存/重新打开发生结构丢失（回归用例覆盖粘贴、撤销、列表/引用等）

#### A3. 粘贴与链接处理（编辑器可靠性）

* [x] 粘贴 URL 自动识别为链接 mark
* [x] 粘贴富文本策略明确（保留结构或转纯文本），并写入测试/回归用例清单
* [x] 自动保存（节流）与保存状态提示（Saving/Saved/Error）
* [x] 乐观锁/版本控制（避免并发覆盖，最小实现即可）

Done - 实现说明：

1. **粘贴 URL 自动链接**：创建 `link-extension.ts`，配置 Tiptap Link 扩展支持 `linkOnPaste` 和 `autolink`
2. **粘贴富文本策略**：创建 `paste-handler-extension.ts`，支持 `preserve`（保留结构）和 `plain`（转纯文本）两种策略
3. **自动保存与状态提示**：创建 `use-auto-save.ts` hook 和 `SaveStatusIndicator` 组件，支持 Saving/Saved/Error 状态显示
4. **乐观锁/版本控制**：在 entries schema 添加 `version` 字段，API 更新时校验版本号，冲突时返回 CONFLICT 错误

---

### B. 复习算法升级（Review v2）

目标：从"规则筛选队列"升级为"到期队列 + 间隔复习"，并保留原模式作为补充视图/过滤器。

#### B1. Review 调度状态（数据模型扩展）

* [x] 新增 `entry_review_state`（使用 entryId 作为主键）
  * [x] `dueAt` - 下次到期时间（notNull）
  * [x] `lastReviewedAt` - 上次复习时间
  * [x] `intervalDays` - 当前间隔天数
  * [x] `ease` - SM-2 ease factor，范围 [1.3, 3.0]
  * [x] `reps` - 连续正确复习次数
  * [x] `lapses` - 遗忘次数
* [x] `review_events` 增加评分字段
  * [x] `rating`: `again | hard | good | easy`（notNull，默认 good）
  * [x] `scheduledDueAt`: 本次复习后计算的下次到期时间

Done: 新建 `entry_review_state` 表（entryId 主键 + userId,dueAt 索引），扩展 `review_events` 表添加 `rating` 和 `scheduledDueAt` 字段。使用懒创建策略，首次复习时创建 state。

#### B2. 复习动作与算法（最小可行）

* [x] `markReviewed` 升级为带评分：`markReviewed(entryId, rating)`
  * [x] 旧调用兼容：不传 rating 默认 `good`
  * [x] 事务化：单个事务内完成 review_events 插入和 entry_review_state upsert
* [x] 最小调度算法（弱化版 SM-2）
  * [x] again：interval = 1, ease -= 0.20, lapses++
  * [x] hard：interval = baseInterval * 1.2, ease -= 0.15
  * [x] good：interval = baseInterval * ease（首轮 = 1）
  * [x] easy：interval = baseInterval \* ease \* 1.3（首轮 = 2）, ease += 0.10
  * [x] 边界处理：ease clamp [1.3, 3.0]，interval >= 1，Math.round() 取整
* [x] 每日上限与补齐策略
  * [x] dailyLimit：用户可配置（默认 50）
  * [x] newLimit：30%（Math.min(20, floor(dailyLimit * 0.3))）
  * [x] 优先 due 条目
  * [x] 不足时用新条目（无 review_state）补齐

Done: 实现弱化版 SM-2 算法模块 `spaced-repetition.ts`，升级 `markReviewed` API 支持事务化 upsert，升级 `getQueue` API 支持 due 规则和配额策略。

#### B3. 队列与页面（Web）

* [x] 默认队列：Due Queue（`dueAt <= now`）
* [x] 保留原四种模式（new/starred/unreviewed/all）作为过滤器
* [x] 评分按钮：Again（红色）/ Hard（橙色）/ Good（绿色）/ Easy（蓝色）
* [x] 统计卡片：待复习数、今日已复习、新条目数、总条目数
* [x] 用户时区支持：前端传 tzOffset，后端按用户时区计算"今日"
* [x] Snooze（跳过/延后）
  * [x] 延后到明天 / 3 天 / 7 天（固定档位）
* [x] 今日统计扩展
  * [x] dueCount、reviewedCount、newCount、streak

Done: 升级 ReviewCard 组件支持四个评分按钮，新增 `getDueStats` API 显示到期统计，添加 due 模式作为默认复习模式。实现 Snooze API 支持延后到明天/3 天/7 天，扩展 `getTodayStats` API 添加 streak 连续天数统计，Web 端 ReviewCard 添加 Snooze 下拉菜单，ReviewDashboard 显示连续天数统计卡片。

验收标准：

* 每条 entry 能稳定生成/更新 `dueAt`
* 同一天多次复习同一条的行为可解释（最小规则：只记录事件但只更新一次状态，或按最后一次为准）
* 队列不会无限膨胀，且用户能通过 Snooze 控制节奏

---

### C. 移动端（Expo，仅 iOS）闭环落地

约束：Tiptap/ProseMirror 依赖 DOM，React Native 无 DOM；MVP v2 采用 WebView 承载富文本编辑器以复用 Web 能力。

#### C1. iOS 端基础功能（最小闭环）

* [ ] 认证流程（登录/注册/退出）
* [ ] 快速文本捕获（Inbox 创建 entry）
* [ ] 收件箱列表（分页/刷新）
* [ ] 今日视图（展示今日 due/待复习数量与入口）
* [ ] 复习流程（至少支持 `good`/`again` 两档）

#### C2. iOS 富文本处理方案（WebView + Tiptap）

* [ ] 只读渲染（优先）
  * [ ] 条目详情页展示富文本（WebView 渲染 JSON）
* [ ] 编辑模式（第二步）
  * [ ] WebView 内嵌 Tiptap 编辑器（复用 Web schema/扩展）
  * [ ] RN ↔ WebView 消息桥接
    * [ ] loadDocument(json)
    * [ ] onChange(json, text)（节流）
    * [ ] onSave（可选）
* [ ] 与服务端同步
  * [ ] 保存 JSON 主内容 + 派生 text
  * [ ] 冲突策略最小可行（基于 updatedAt/version）

验收标准：

* iOS 真机上可以创建条目 → 编辑（或只读）→ 在 Web 端打开内容一致
* iOS 端复习一次能在 Web 端看到 review 记录/队列变化
* WebView 编辑器输入中文、换行、撤销/重做无明显崩坏（列入回归清单）

#### C3. 分享扩展（iOS Share Extension）【可选，若时间允许】

* [ ] 接收文本/URL，写入 Inbox
* [ ] 去重/合并策略（可延后）

---

## 数据模型（v2）

### 已有（v1）

* [x] users（Better Auth）
* [x] entries
* [x] tags
* [x] entry_tags
* [x] sources
* [x] entry_sources
* [x] review_events

### 新增/调整（v2）

* [ ] entry_review_state（推荐新增表）
* [ ] entries 内容字段调整（建议）
  * [ ] `content_json`（主存）
  * [ ] `content_text`（派生）

---

## API 变更（v2）

* [ ] entries
  * [ ] 支持读取/保存 `content_json` 与 `content_text`
* [ ] review
  * [ ] `markReviewed(entryId, rating?)`
  * [ ] `getQueue` 默认返回 due 条目（支持 limit、补齐策略参数可选）
  * [ ] `snooze(entryId, untilAt | preset)`

---

## 平台支持（v2）

### Web 应用

* [x] 现有页面与功能（v1 完整）
* [ ] 编辑器升级（Slash Menu、粘贴、自动保存、存储统一）
* [ ] 复习升级（评分、due 队列、snooze、统计扩展）

### 移动应用（Expo，仅 iOS）

* [ ] 认证流程
* [ ] 快速捕获
* [ ] 收件箱列表
* [ ] 今日视图
* [ ] 复习流程
* [ ] 富文本：WebView 只读渲染（优先）与编辑（次优先）

### D. 国际化（i18n）支持（Web + iOS + Server）

目标：统一管理多语言资源，支持 Web、iOS（Expo）、以及 Server 接口返回的本地化 msg（同时保留稳定 error code）。

#### D1. 共享 locales 子包

* [x] 新增 `packages/locales` 统一管理语言资源（例如 `en-US`、`zh-CN`）
* [x] 统一 key 命名规范（如 `auth.*` / `entry.*` / `review.*`）
* [x] 插值与复数规则使用 ICU MessageFormat
* [x] CI 校验：各语言 key 一致（缺失/多余 key 报错）

Done: 创建了 `packages/locales` 子包，包含 `en-US.json` 和 `zh-CN.json` 语言资源文件，定义了 `common`、`auth`、`entry`、`tag`、`source`、`review`、`nav`、`search`、`editor`、`error` 等命名空间。支持 i18next v4 JSON 格式的复数规则（`_one`/`_other`）和插值（`{{count}}`）。添加了 `packages/locales/scripts/check-keys.ts` 脚本用于 CI 校验 key 一致性。

#### D2. Web / Native 集成

* [x] Web：提供 `t(key, params)`（或 Provider/hook）替换关键 UI 文案
* [x] iOS：同样提供 `t(key, params)`，覆盖导航、按钮、空态、错误提示
* [x] 支持语言切换与 fallback（默认 en-US，或按产品策略）

Done: Web 端集成 react-i18next，在 `__root.tsx` 引入 I18nextProvider，所有页面和组件已使用 `useTranslation` hook；Native 端集成 i18next + expo-localization，自动检测设备语言，首页、登录、注册、导航等 UI 已国际化。

#### D3. Server 接口 msg 国际化（双轨）

* [x] Server 根据 `X-Locale` / `Accept-Language` / 用户设置解析 locale
* [x] 错误返回结构包含：
  * [x] `code`（稳定）
  * [x] `message`（服务端按 locale 渲染）
  * [x] `params`（可选）
* [x] 设置 `Vary: Accept-Language, X-Locale`（若使用缓存）

Done: 扩展 `packages/api/src/context.ts` 解析 `X-Locale` 和 `Accept-Language` 头，添加 `locale` 到 context；创建 `getLocalizedErrorMessage` 和 `createLocalizedError` 工具函数，支持 params 插值；Server 响应头已添加 `Vary: Accept-Language, X-Locale`。

验收标准：

* Web / iOS / Server 在相同 locale 下对关键错误与空态展示一致语义
* 语言切换后无需改业务逻辑即可改变 UI 文案
* Server 错误响应始终包含稳定 `code`，并提供对应语言 `message`

---

## MVP v2 范围外（Out of Scope）

### 功能

* ❌ 附件/图片上传
* ❌ 高级搜索（全文搜索、Postgres FTS）
* ❌ 洞察/统计大盘（除复习页必要统计外）
* ❌ 每日日志 (Daily Logs)
* ❌ 批量操作
* ❌ 数据导入/导出（可保留为后续）
* ❌ 协作功能
* ❌ 公共 API

### 移动端

* ❌ Android 支持
* ❌ 离线模式（移动端）
* ❌ 推送通知
* ❌ 原生富文本编辑器（Swift 原生实现）

### 技术与运营

* ❌ 第三方登录（OAuth）
* ❌ 多语言
* ❌ 自定义主题系统（先跟随系统）
* ❌ 付费/订阅、用户分析、A/B 测试

---

## 成功标准（MVP v2 完成标志）

1. Web 端编辑器支持 `/` 命令菜单，显著提升写作效率，并且内容存储方案稳定统一
2. 复习系统支持到期队列与评分，用户可以用“每天固定量”稳定复习而不爆炸
3. iOS 端实现“捕获 →（只读/可选编辑）→ 复习”的最小闭环，且与 Web 数据一致同步
4. 关键流程具备基础回归用例清单（编辑器输入、粘贴、保存、复习队列生成）

---

## 里程碑建议（可并行）

### Milestone A：编辑器升级（Web）

* Slash Menu + 1 个 FolioNote 命令（tag/source/ref）
* 内容主存 JSON + 派生 text
* 粘贴处理 + 自动保存

### Milestone B：Review v2

* entry_review_state + rating
* due 队列 + snooze
* Web 复习页升级

### Milestone C：iOS（Expo）

* 认证 + Inbox + 今日 + 复习
* WebView 只读渲染（优先），可编辑（次优先）

---

## 技术栈

| 层级 | 技术 |
|---|---|
| Web 前端 | TanStack Start, React, TailwindCSS |
| 移动端 | Expo, React Native（仅 iOS） |
| 富文本 | Tiptap (ProseMirror)；iOS 端通过 WebView 复用 |
| API | Hono, oRPC |
| 数据库 | PostgreSQL, Drizzle ORM |
| 认证 | Better Auth |
| 部署 | 待定 |
