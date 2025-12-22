# 条目管理功能文档

## 概述

条目管理是 FolioNote 的核心功能，允许用户创建、编辑、删除和组织学习笔记。

## 富文本内容存储策略

为支持跨端一致性（iOS WebView 编辑器与 Web 端），采用以下存储策略：

### 数据字段

| 字段 | 类型 | 描述 |
|------|------|------|
| content | text | HTML 格式内容（向后兼容，已弃用） |
| contentJson | text | ProseMirror JSON 格式（Tiptap doc），主存储格式 |
| contentText | text | 纯文本派生字段，用于 ILIKE 搜索与摘要预览 |

### 存储规则

1. **写入时**：优先使用 `contentJson`，自动派生 `contentText`
2. **读取时**：优先使用 `contentJson`，向后兼容 `content`（HTML）
3. **搜索/预览**：使用 `contentText` 字段

### 迁移兼容

- 现有 HTML 内容（`content` 字段）保持兼容读取
- 新内容统一使用 `contentJson` 存储
- API 返回中同时提供 `content`、`contentJson`、`contentText`

## API 端点

所有条目相关的 API 端点都需要用户认证。

### entries.create

创建新条目。

**输入参数：**

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| title | string | 否 | '' | 条目标题 |
| content | string | 否 | '' | 条目内容（HTML，向后兼容） |
| contentJson | string | 否 | - | 条目内容（ProseMirror JSON，推荐） |
| isInbox | boolean | 否 | true | 是否放入收件箱 |

**返回：** 创建的条目对象

### entries.update

更新现有条目。

**输入参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | string | 是 | 条目 ID |
| title | string | 否 | 新标题 |
| content | string | 否 | 新内容（HTML，向后兼容） |
| contentJson | string | 否 | 新内容（ProseMirror JSON，推荐） |
| isInbox | boolean | 否 | 是否在收件箱 |
| isStarred | boolean | 否 | 是否收藏 |
| isPinned | boolean | 否 | 是否置顶 |

**返回：** 更新后的条目对象

### entries.delete

软删除条目（设置 deletedAt 字段）。

**输入参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | string | 是 | 条目 ID |

**返回：** `{ success: true }`

### entries.restore

恢复已删除的条目。

**输入参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | string | 是 | 条目 ID |

**返回：** 恢复后的条目对象

### entries.get

获取单个条目。

**输入参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | string | 是 | 条目 ID |

**返回：** 条目对象

### entries.list

列表查询条目，支持筛选和游标分页。

**输入参数：**

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| filter | enum | 否 | 'all' | 筛选类型 |
| tagId | string | 否 | - | 按标签筛选 |
| cursor | string | 否 | - | 分页游标 |
| limit | number | 否 | 20 | 每页数量（1-100） |

**筛选类型：**

- `inbox` - 收件箱中的条目
- `starred` - 收藏的条目
- `pinned` - 置顶的条目
- `deleted` - 已删除的条目
- `all` - 所有未删除的条目

**返回：**

```typescript
{
  items: Entry[]
  nextCursor?: string
  hasMore: boolean
}
```

### entries.addTag

为条目添加标签。

**输入参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| entryId | string | 是 | 条目 ID |
| tagId | string | 是 | 标签 ID |

**返回：** `{ success: true, entryTag: EntryTag }`

### entries.removeTag

从条目移除标签。

**输入参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| entryId | string | 是 | 条目 ID |
| tagId | string | 是 | 标签 ID |

**返回：** `{ success: true, deleted: boolean }`

### entries.getTags

获取条目的所有标签。

**输入参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | string | 是 | 条目 ID |

**返回：** `Tag[]`

## Web 页面

### 收件箱 `/inbox`

- 快速捕获输入框（按 Enter 快速创建条目）
- 条目卡片列表（最新在前）
- 支持无限滚动加载更多

### 资料库 `/library`

- 筛选标签：全部 / 收藏
- 条目卡片网格布局
- 新建笔记按钮
- 支持无限滚动加载更多

### 条目编辑 `/entries/:id`

- Tiptap 富文本编辑器
- 自动保存（500ms 防抖）
- 标签管理：添加/移除标签，创建新标签
- 操作栏：收藏、置顶、删除、移至收件箱/资料库
- 显示创建和更新时间

### 新建条目 `/entries/new`

- 空白编辑器
- 保存后跳转到编辑页面

## 组件

### EntryEditor

Tiptap 富文本编辑器封装，支持：

- Markdown 快捷键
- 标题（H1-H3）
- 列表（有序/无序）
- 引用块
- 代码块
- 自动保存
- **内容格式**：支持 `json`（推荐）和 `html`（向后兼容）两种格式
- **onChange 回调**：同时返回 HTML 和 JSON 格式内容

**Props：**

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| content | string | - | 初始内容（JSON 字符串或 HTML） |
| contentFormat | 'json' \| 'html' | 'json' | 内容格式 |
| onChange | (html, json) => void | - | 内容变更回调 |
| placeholder | string | 'Write something...' | 占位符文本 |
| editable | boolean | true | 是否可编辑 |
| autoFocus | boolean | false | 是否自动聚焦 |

### EntryCard

条目卡片组件，显示：

- 标题
- 内容预览（优先使用 `contentText`，前 150 字符）
- 更新时间
- 收藏/置顶状态
- 悬停时显示操作按钮

**Props：**

| 属性 | 类型 | 描述 |
|------|------|------|
| contentText | string \| null | 纯文本内容（优先用于预览） |
| content | string | HTML 内容（向后兼容） |

### EntryList

条目列表组件，支持：

- 置顶条目优先显示
- 加载状态骨架屏
- 空状态提示
- 加载更多按钮

### QuickCapture

快速捕获输入框，支持：

- 按 Enter 快速创建
- 自动识别标题（第一行短文本）
- 加载状态指示

### EntryTags

条目标签管理组件，支持：

- 显示条目当前标签
- 添加/移除标签
- 创建新标签
- 弹出式选择器

## 文件结构

```text
packages/db/src/schema/
└── entries.ts              # 数据库 Schema（含 contentJson、contentText 字段）

packages/api/src/
├── routers/
│   └── entries.ts          # API 路由
└── utils/
    └── content.ts          # 内容转换工具（JSON/Text 提取）

apps/web/src/
├── components/
│   ├── entry-card.tsx      # 卡片组件
│   ├── entry-editor.tsx    # 编辑器组件
│   ├── entry-list.tsx      # 列表组件
│   ├── entry-tags.tsx      # 标签管理组件
│   └── quick-capture.tsx   # 快速捕获组件
└── routes/
    ├── inbox.tsx           # 收件箱页面
    ├── library.tsx         # 资料库页面
    └── entries/
        ├── $id.tsx         # 编辑页面
        └── new.tsx         # 新建页面
```

## 依赖

- `nanoid` - ID 生成
- `@tiptap/react` - 富文本编辑器
- `@tiptap/starter-kit` - 基础扩展
- `@tiptap/extension-placeholder` - 占位符扩展

## 内容转换工具

位于 `packages/api/src/utils/content.ts`，提供以下函数：

| 函数 | 描述 |
|------|------|
| `extractTextFromProseMirrorJson` | 从 ProseMirror JSON 提取纯文本 |
| `extractTextFromHtml` | 从 HTML 提取纯文本 |
| `generateContentPreview` | 生成截断预览文本 |
| `isValidProseMirrorJson` | 验证 JSON 格式是否有效 |
| `createEmptyProseMirrorDoc` | 创建空文档 |
| `processContentUpdate` | 处理内容更新（返回 JSON 和 Text） |
