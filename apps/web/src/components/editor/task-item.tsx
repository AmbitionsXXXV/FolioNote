import { Checkbox } from "@heroui/react"
import { TaskItem as TaskItemNode } from "@tiptap/extension-list"
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer
} from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { useTranslation } from "react-i18next"

function TaskItemView({ node, editor, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation()
  const checked = node.attrs.checked === true

  return (
    <NodeViewWrapper className="task-item">
      <div className="task-item-check" contentEditable={false}>
        <Checkbox
          aria-label={node.textContent || t("editor.slashCommand.taskList")}
          isReadOnly={!editor.isEditable}
          isSelected={checked}
          onChange={(isSelected) => updateAttributes({ checked: isSelected })}
        >
          {/* Content is the pressable part (it renders the input); a Control
              outside it draws a box that can't be clicked. */}
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      </div>
      <NodeViewContent className="task-item-content" />
    </NodeViewWrapper>
  )
}

/**
 * Web editor flavour of the shared schema node: the checkbox is the design
 * system's Checkbox instead of TaskItem's bare <input>. The <li> keeps
 * `data-checked` so the stylesheet (and copy-as-HTML) see the state.
 */
export const TaskItem = TaskItemNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TaskItemView, {
      as: "li",
      attrs: ({ node }) => ({ "data-checked": String(node.attrs.checked) })
    })
  }
})
