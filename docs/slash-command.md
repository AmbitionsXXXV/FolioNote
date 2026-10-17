# Tiptap Slash Command 实现文档

## 概述

FolioNote 编辑器实现了 Notion 风格的 Slash Command（斜杠命令）功能，用户在编辑器中输入 `/` 即可打开命令菜单，快速插入各种内容块。

## 功能特性

### 基础命令

| 命令       | 描述                 | 关键词                        |
| ---------- | -------------------- | ----------------------------- |
| `/h1`      | 大标题               | h1, heading1, title, 标题     |
| `/h2`      | 中标题               | h2, heading2, subtitle, 标题  |
| `/h3`      | 小标题               | h3, heading3, 标题            |
| `/quote`   | 引用块               | quote, blockquote, 引用       |
| `/code`    | 代码块（带语法高亮） | code, codeblock, 代码         |
| `/bullet`  | 无序列表             | bullet, list, unordered, 列表 |
| `/ordered` | 有序列表             | ordered, list, numbered, 列表 |
| `/divider` | 分割线               | divider, hr, horizontal, 分割 |

### FolioNote 命令

| 命令      | 描述           | 状态      |
| --------- | -------------- | --------- |
| `/tag`    | 为条目添加标签 | ✅ 已实现 |
| `/source` | 关联来源       | 🔲 待实现 |
| `/ref`    | 插入条目引用   | 🔲 待实现 |

### 交互特性

- **搜索过滤**：输入 `/` 后继续输入可过滤命令列表
- **键盘导航**：
  - `↑` / `↓`：上下选择命令
  - `Enter`：执行选中的命令
  - `Escape`：关闭菜单
- **鼠标交互**：悬停高亮，点击执行
- **分组显示**：命令按类别分组（标题、基础块、列表、FolioNote）

## 技术实现

### 文件结构

```plaintext
apps/web/src/components/editor/
├── slash-command.tsx    # 核心扩展和菜单组件
└── tag-command.tsx      # /tag 命令工厂
```

### 核心组件

#### SlashCommand 扩展

基于 `@tiptap/suggestion` 实现的 Tiptap 扩展：

```typescript
import { SlashCommand } from "@/components/editor/slash-command"

// 在编辑器中使用
const editor = useEditor({
  extensions: [
    StarterKit,
    SlashCommand.configure({
      commands: [...getDefaultSlashCommands(), ...customCommands]
    })
  ]
})
```

#### SlashCommandItem 类型

```typescript
type SlashCommandItem = {
  title: string // 显示标题
  description: string // 描述文字
  icon: ReactNode // 图标
  command: (props: { editor: Editor; range: Range }) => void // 执行函数
  keywords?: string[] // 搜索关键词
  group?: string // 分组名称
}
```

#### 自定义命令

可以通过 `additionalCommands` prop 添加自定义命令：

```tsx
import { createTagCommand } from '@/components/editor/tag-command'

const tagCommand = createTagCommand({
  getTags: () => availableTags,
  onAddTag: (tagId) => addTagToEntry(tagId),
})

<EntryEditor
  additionalCommands={[tagCommand]}
  content={content}
  onChange={handleChange}
/>
```

### 样式

Slash Command 菜单样式定义在 `apps/web/src/styles/tiptap.css` 中：

- `.slash-command-menu`：菜单容器
- `.slash-command-group`：命令分组
- `.slash-command-item`：单个命令项
- `.slash-command-item.is-selected`：选中状态

### 依赖

- `@tiptap/suggestion`：Tiptap 建议/自动完成功能
- `@tiptap/extension-code-block-lowlight`：代码块语法高亮扩展
- `lowlight`：语法高亮引擎（基于 highlight.js）
- `tippy.js`：弹出层定位

### 代码高亮

代码块使用 `lowlight` 实现语法高亮，默认加载常见语言：

- JavaScript/TypeScript
- Python
- CSS/HTML
- JSON/YAML
- Bash/Shell
- SQL
- 更多...

## 使用示例

### 基础使用

```tsx
import { EntryEditor } from "@/components/entry-editor"

function MyEditor() {
  return (
    <EntryEditor
      content=""
      onChange={(html) => console.log(html)}
      placeholder="输入 / 打开命令菜单"
    />
  )
}
```

### 带自定义命令

```tsx
import type { SlashCommandItem } from "@/components/editor/slash-command"
import { EntryEditor } from "@/components/entry-editor"

const customCommand: SlashCommandItem = {
  title: "自定义命令",
  description: "执行自定义操作",
  icon: <span>🎯</span>,
  keywords: ["custom"],
  group: "自定义",
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).insertContent("Hello!").run()
  }
}

function MyEditor() {
  return (
    <EntryEditor
      additionalCommands={[customCommand]}
      content=""
      onChange={(html) => console.log(html)}
    />
  )
}
```

## 扩展指南

### 添加新命令

1. 在 `slash-command.tsx` 的 `getDefaultSlashCommands()` 中添加
2. 或创建单独的命令工厂文件（如 `tag-command.tsx`）

### 命令最佳实践

1. **清理触发文本**：命令执行时先调用 `deleteRange(range)` 删除 `/` 和输入的文字
2. **保持焦点**：使用 `chain().focus()` 确保编辑器保持焦点
3. **提供关键词**：添加中英文关键词提升搜索体验
4. **合理分组**：使用 `group` 属性将相关命令归类

## 后续计划

- [ ] 实现 `/source` 命令：搜索并关联来源
- [ ] 实现 `/ref` 命令：插入条目引用链接
- [ ] 支持命令快捷键提示
- [ ] 添加命令使用频率排序
