# 命令面板（cmdk）样式注意事项

本项目的 Web 命令面板基于 `cmdk`，相关组件封装在 `apps/web/src/components/ui/command.tsx`，样式在 `apps/web/src/index.css`（以 `.cn-command-*` 作为命名空间）。

## 选中态属性与 Tailwind 变体

`cmdk` 的 `Command.Item` 会在每个 item 上渲染 `data-selected="true|false"`（以及 `aria-selected="true|false"`）。因此：

- 如果样式使用 `data-selected:` / `group-data-selected:` 这种“仅判断属性是否存在”的写法，会把 `data-selected="false"` 的 item 也命中，导致 item 看起来有“默认底色”。
- 应使用“只匹配 true” 的写法，例如 `data-[selected=true]:...` / `group-data-[selected=true]/...`，确保只有被选中（或指针悬停触发选中）的 item 才会呈现高亮效果。

示例（来自 `apps/web/src/index.css` 的修正方向）：

```css
.cn-command-item {
 @apply data-[selected=true]:bg-muted;
}

.cn-command-shortcut {
 @apply group-data-[selected=true]/command-item:text-foreground;
}
```

## 修复记录

- 2025-12-21：将 `.cn-command-item` / `.cn-command-shortcut` 的选中态从 `data-selected:` / `group-data-selected:` 改为 `data-[selected=true]:` / `group-data-[selected=true]`，避免 `data-selected="false"` 误命中。
