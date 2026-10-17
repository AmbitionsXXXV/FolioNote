# 编辑器功能文档

本文档描述 FolioNote 编辑器的核心功能实现。

## 粘贴与链接处理

### 1. 粘贴 URL 自动识别为链接

**文件**: `apps/web/src/components/editor/link-extension.ts`

基于 Tiptap Link 扩展实现，配置如下：

- `linkOnPaste: true` - 粘贴 URL 时自动转换为链接
- `autolink: true` - 输入 URL 时自动检测并转换
- `defaultProtocol: 'https'` - 默认协议为 HTTPS
- `openOnClick: false` - 编辑模式下点击链接不自动打开
- `enableClickSelection: true` - 点击链接时选中文本

**安全配置**：

- HTML 属性包含 `rel="noopener noreferrer"` 和 `target="_blank"`
- URL 验证只允许 `http:`, `https:`, `mailto:`, `tel:` 协议
- 不允许相对路径链接

### 2. 粘贴富文本策略

**文件**: `apps/web/src/components/editor/paste-handler-extension.ts`

支持两种粘贴策略：

- `preserve`（默认）：保留富文本结构
- `plain`：转换为纯文本

**特殊处理**：

- 粘贴纯 URL 文本时，自动转换为可点击链接
- 如果有选中文本，将选中文本转换为链接
- 如果没有选中文本，插入 URL 作为链接文本

**使用方式**：

```tsx
<EntryEditor
  content={content}
  onChange={handleChange}
  pasteStrategy="preserve" // 或 "plain"
/>
```

## 表格（Table）

### 1. 工具栏与交互

**文件**：

- `packages/editor-react/src/components/table-node-view.tsx`
- `packages/editor-react/src/components/table-controls.tsx`
- `packages/editor-react/src/components/table-floating-toolbar.tsx`

行为说明：

- 行、列工具栏会跟随鼠标所在行或列进行定位。
- 行、列工具栏提供新增行列与菜单入口。
- 表格尺寸变化时，边缘悬浮工具栏会同步更新位置与尺寸。

### 2. 样式约束

**文件**：

- `apps/web/src/styles/table.css`

样式说明：

- 表头行（`th`）背景色与普通行保持一致。
- 行、列工具栏与表格边界的间距由 `--table-control-gap` 控制，默认设为 `0px` 以保证工具栏可达。
- 表格内容容器使用 `display: contents`，避免 table 边界与容器错位。

## 自动保存

### 1. useAutoSave Hook

**文件**: `apps/web/src/hooks/use-auto-save.ts`

提供节流的自动保存功能，并跟踪保存状态。

**配置选项**：

- `onSave`: 保存函数
- `debounceMs`: 节流延迟（默认 1000ms）
- `savedDurationMs`: 保存成功后显示 "已保存" 状态的持续时间（默认 2000ms）

**返回值**：

- `status`: 当前保存状态（`idle` | `saving` | `saved` | `error`）
- `save`: 触发保存（会节流）
- `saveImmediately`: 立即保存（不节流）
- `reset`: 重置状态为 idle
- `isPending`: 是否有待保存的更改

**使用示例**：

```tsx
const { status, save } = useAutoSave({
  onSave: async (data) => {
    await api.updateEntry(data)
  },
  debounceMs: 1000
})

const handleChange = (content: string) => {
  save({ id, content })
}
```

### 2. SaveStatusIndicator 组件

**文件**: `apps/web/src/components/save-status-indicator.tsx`

显示保存状态的 UI 组件：

- `idle`: 不显示
- `saving`: 显示旋转图标 + "保存中..."
- `saved`: 显示绿色勾号 + "已保存"
- `error`: 显示红色警告 + "保存失败"

**使用示例**：

```tsx
<SaveStatusIndicator status={saveStatus} />
```

## 乐观锁/版本控制

### 数据库 Schema

**文件**: `packages/db/src/schema/entries.ts`

在 entries 表添加 `version` 字段：

```typescript
version: text('version').notNull().default('1'),
```

### API 实现

**文件**: `packages/api/src/routers/entries.ts`

更新 API 支持版本检查：

1. 客户端发送 `expectedVersion` 参数
2. 服务端检查版本是否匹配
3. 匹配则更新并递增版本号
4. 不匹配则返回 `CONFLICT` 错误

**错误响应**：

```json
{
  "code": "CONFLICT",
  "message": "Version conflict: entry has been modified by another client",
  "data": {
    "currentVersion": "2",
    "expectedVersion": "1"
  }
}
```

### 前端处理

在条目编辑页面 (`apps/web/src/routes/_app/entries/$id.tsx`)：

1. 跟踪当前版本号
2. 每次保存时发送期望版本号
3. 保存成功后更新本地版本号
4. 版本冲突时提示用户刷新页面

## 回归测试用例清单

### 粘贴功能

- [ ] 粘贴纯 URL 文本，应自动转换为可点击链接
- [ ] 粘贴 URL 到选中文本上，应将选中文本转换为链接
- [ ] 粘贴富文本（从 Word/网页），应保留基本结构
- [ ] 粘贴富文本时设置 `pasteStrategy="plain"`，应转换为纯文本

### 链接功能

- [ ] 输入 URL 后按空格，应自动转换为链接
- [ ] 点击链接不应自动打开（编辑模式）
- [ ] 链接应有正确的 rel 和 target 属性

### 自动保存功能

- [ ] 编辑内容后 1 秒内应显示 "保存中..."
- [ ] 保存成功后应显示 "已保存"
- [ ] 保存失败后应显示 "保存失败"
- [ ] 连续快速编辑应正确节流

### 表格

- [ ] 悬停表格行时显示行工具栏，位置与行垂直居中对齐
- [ ] 悬停表格列时显示列工具栏，位置与列水平居中对齐
- [ ] 调整列宽或新增行列后，边缘悬浮工具栏位置应同步更新
- [ ] 表头行背景色与普通行一致

### 版本控制

- [ ] 正常保存应更新版本号
- [ ] 并发编辑时应检测版本冲突
- [ ] 版本冲突时应提示用户刷新

## 页面内目录（TOC）

### 概述

在分享页、编辑页和新建页显示"本页目录"侧边栏，帮助用户快速导航长文档。

基于 [fumadocs-core/toc](https://www.fumadocs.dev/docs/headless/components/toc) 实现，提供开箱即用的 IntersectionObserver 追踪和自动滚动功能。

**相关文件**：

- `apps/web/src/lib/toc.ts` - TOC 提取与 slug 生成工具（输出 `TOCItemType` 格式）
- `apps/web/src/hooks/use-toc-position.ts` - TOC 位置设置 Hook
- `apps/web/src/components/table-of-contents.tsx` - TOC 组件（使用 fumadocs-core）

### 功能特性

- **标题提取**：从 ProseMirror JSON 内容中提取 H1-H3 标题
- **稳定锚点**：为每个标题生成 URL 友好的 slug，重复标题自动追加序号
- **滚动高亮**：使用 fumadocs `AnchorProvider` + IntersectionObserver 追踪当前可见章节
- **自动滚动**：使用 fumadocs `ScrollProvider` 自动滚动 TOC 容器到活跃条目
- **平滑滚动**：点击目录条目平滑滚动到对应标题
- **位置可配置**：用户可选择 TOC 显示在左侧或右侧（localStorage 持久化）
- **响应式隐藏**：移动端（< lg 断点）自动隐藏

### 样式参考

TOC 样式参考 fumadocs UI（`packages/ui/src/components/toc/index.tsx`、`packages/ui/src/components/toc/default.tsx`、`packages/radix-ui/src/layouts/docs/page/index.tsx`），并将 `fd` 前缀的 CSS 变量/token 翻译为 Folio 自有的：

| fumadocs                   | Folio                   |
| -------------------------- | ----------------------- |
| `--fd-nav-height`          | `--folio-nav-height`    |
| `text-fd-muted-foreground` | `text-muted-foreground` |
| `text-fd-primary`          | `text-primary`          |
| `border-fd-foreground/10`  | `border-foreground/10`  |
| `bg-fd-primary`            | `bg-primary`            |

### 配置

**CSS 变量**（`apps/web/src/index.css`）：

```css
:root {
  /* TOC sidebar sticky positioning - set to actual nav height if you have a fixed header */
  --folio-nav-height: 0px;
}
```

**localStorage Key**：`folio-toc-position`

- 值：`'left'` 或 `'right'`
- 默认值：`'right'`

### 编辑页更新节奏

为避免编辑时 TOC 密集更新：

1. 编辑页复用 `useAutoSave` 的 1000ms 防抖
2. 仅在 `onSave` 回调完成后更新 TOC items
3. 新建页使用独立的 500ms 防抖更新 TOC

### 使用示例

```tsx
import { useEffect, useMemo, useRef, useState } from "react"

import { TableOfContents } from "@/components/table-of-contents"
import { useTocPosition } from "@/hooks/use-toc-position"
import { parseTocFromContent, assignHeadingIds } from "@/lib/toc"

function MyPage() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [tocPosition] = useTocPosition()
  const [tocRenderKey, setTocRenderKey] = useState(0)
  // parseTocFromContent 返回 TOCItemType[] 格式，兼容 fumadocs-core/toc
  const tocItems = useMemo(
    () => parseTocFromContent(contentJson),
    [contentJson]
  )

  // TipTap 可能延迟把 heading 渲染进 DOM（例如 immediatelyRender: false），
  // 所以需要在 heading 出现后再触发一次 TOC remount，确保 IntersectionObserver 能 observe 到元素。
  useEffect(() => {
    const container = contentRef.current
    if (!container || tocItems.length === 0) return

    let didRemount = false

    const assignAndMaybeRemount = () => {
      assignHeadingIds(container, tocItems)

      const hasAnyObservedHeading = tocItems.some((item) => {
        const id = item.url.split("#")[1] ?? item.url.slice(1)
        if (!id) return false
        const element = document.getElementById(id)
        return element !== null && container.contains(element)
      })

      if (hasAnyObservedHeading && !didRemount) {
        didRemount = true
        setTocRenderKey((prev) => prev + 1)
        return true
      }

      return hasAnyObservedHeading
    }

    if (typeof MutationObserver === "undefined") {
      assignAndMaybeRemount()
      return
    }

    if (assignAndMaybeRemount()) return

    const observer = new MutationObserver(() => {
      if (assignAndMaybeRemount()) observer.disconnect()
    })

    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [tocItems])

  const hasToc = tocItems.length > 0

  return (
    <div className="flex">
      {hasToc && tocPosition === "left" && (
        <TableOfContents
          key={tocRenderKey}
          items={tocItems}
          position={tocPosition}
        />
      )}
      <main ref={contentRef}>{/* content */}</main>
      {hasToc && tocPosition === "right" && (
        <TableOfContents
          key={tocRenderKey}
          items={tocItems}
          position={tocPosition}
        />
      )}
    </div>
  )
}
```

### 回归测试用例

- [ ] 文档包含 H1-H3 时显示 TOC，无标题时不显示
- [ ] 点击 TOC 条目能平滑滚动到对应标题
- [ ] 滚动页面时高亮当前可见章节
- [ ] 切换左右位置后刷新页面仍保持设置
- [ ] 移动端（< lg）不显示 TOC
- [ ] 编辑时 TOC 不会在每次按键时更新（有防抖）
