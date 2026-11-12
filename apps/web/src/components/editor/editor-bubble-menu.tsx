import { useEditorCommands } from "@folionote/editor-react"
import { Button } from "@folionote/ui/button"
import { Input } from "@folionote/ui/input"
import { cn } from "@folionote/ui/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@folionote/ui/popover"
import { Separator } from "@folionote/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@folionote/ui/tooltip"
import {
  CodeIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link04Icon,
  QuoteUpIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  Unlink04Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Editor } from "@tiptap/react"
import { useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import type { ComponentProps, KeyboardEvent, MouseEvent } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

type IconType = ComponentProps<typeof HugeiconsIcon>["icon"]

// Keep the editor selection alive while pressing toolbar controls — the
// command chain re-focuses, but preventing the mousedown blur avoids a flicker
// of the bubble menu disappearing mid-click.
function keepSelection(event: MouseEvent) {
  event.preventDefault()
}

interface ToolbarButtonProps {
  icon: IconType
  label: string
  isActive: boolean
  onToggle: () => void
}

function ToolbarButton({
  icon,
  label,
  isActive,
  onToggle
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          aria-label={label}
          aria-pressed={isActive}
          className={cn(
            "size-8 text-muted-foreground",
            isActive && "bg-surface-secondary text-foreground"
          )}
          onClick={onToggle}
          onMouseDown={keepSelection}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon className="size-4" icon={icon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolbarSeparator() {
  return <Separator className="mx-0.5 h-5" orientation="vertical" />
}

interface LinkPopoverButtonProps {
  editor: Editor
  isActive: boolean
}

function LinkPopoverButton({ editor, isActive }: LinkPopoverButtonProps) {
  const { t } = useTranslation()
  const { setLink, unsetLink } = useEditorCommands(editor)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setUrl((editor.getAttributes("link").href as string | undefined) ?? "")
    }
    setOpen(next)
  }

  const apply = () => {
    const trimmed = url.trim()
    if (trimmed) {
      setLink(trimmed)
    } else {
      unsetLink()
    }
    setOpen(false)
  }

  const remove = () => {
    unsetLink()
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === "Enter") {
      event.preventDefault()
      apply()
    }
  }

  const label = t("editor.toolbar.link")

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={isActive}
            className={cn(
              "size-8 text-muted-foreground",
              isActive && "bg-surface-secondary text-foreground"
            )}
            onMouseDown={keepSelection}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon className="size-4" icon={Link04Icon} />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" side="top">
        <div className="flex items-center gap-1.5">
          <Input
            aria-label={label}
            className="h-8 flex-1"
            onChange={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("editor.toolbar.linkPlaceholder")}
            type="url"
            value={url}
          />
          {isActive && (
            <Button
              aria-label={t("editor.toolbar.linkRemove")}
              className="size-8 text-muted-foreground"
              onClick={remove}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon className="size-4" icon={Unlink04Icon} />
            </Button>
          )}
          <Button onClick={apply} size="sm" type="button" variant="secondary">
            {t("editor.toolbar.linkApply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Selection bubble toolbar for the entry editor, inspired by HeroUI Pro's
 * RichTextEditor bubble menu. Surfaces inline formatting, heading levels,
 * lists, blockquote and a link popover whenever a non-empty text range is
 * selected. The block-level slash menu and block handle already cover
 * empty-line affordances, so no floating menu is added here.
 */
export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const commands = useEditorCommands(editor)

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      strike: instance.isActive("strike"),
      code: instance.isActive("code"),
      h1: instance.isActive("heading", { level: 1 }),
      h2: instance.isActive("heading", { level: 2 }),
      h3: instance.isActive("heading", { level: 3 }),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
      blockquote: instance.isActive("blockquote"),
      link: instance.isActive("link")
    })
  })

  return (
    <BubbleMenu
      className="z-50 flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      pluginKey="entryEditorBubbleMenu"
      shouldShow={({ editor: instance, from, to }) => {
        if (!instance.isEditable) {
          return false
        }
        // Hide inside code blocks where inline formatting does not apply, and
        // for node selections (e.g. images) that carry no text.
        if (instance.isActive("codeBlock")) {
          return false
        }
        return instance.state.doc.textBetween(from, to, " ").trim().length > 0
      }}
    >
      <ToolbarButton
        icon={TextBoldIcon}
        isActive={active.bold}
        label={t("editor.toolbar.bold")}
        onToggle={commands.toggleBold}
      />
      <ToolbarButton
        icon={TextItalicIcon}
        isActive={active.italic}
        label={t("editor.toolbar.italic")}
        onToggle={commands.toggleItalic}
      />
      <ToolbarButton
        icon={TextStrikethroughIcon}
        isActive={active.strike}
        label={t("editor.toolbar.strikethrough")}
        onToggle={commands.toggleStrike}
      />
      <ToolbarButton
        icon={CodeIcon}
        isActive={active.code}
        label={t("editor.toolbar.code")}
        onToggle={commands.toggleCode}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={Heading01Icon}
        isActive={active.h1}
        label={t("editor.toolbar.heading1")}
        onToggle={() => commands.toggleHeading(1)}
      />
      <ToolbarButton
        icon={Heading02Icon}
        isActive={active.h2}
        label={t("editor.toolbar.heading2")}
        onToggle={() => commands.toggleHeading(2)}
      />
      <ToolbarButton
        icon={Heading03Icon}
        isActive={active.h3}
        label={t("editor.toolbar.heading3")}
        onToggle={() => commands.toggleHeading(3)}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={LeftToRightListBulletIcon}
        isActive={active.bulletList}
        label={t("editor.toolbar.bulletList")}
        onToggle={commands.toggleBulletList}
      />
      <ToolbarButton
        icon={LeftToRightListNumberIcon}
        isActive={active.orderedList}
        label={t("editor.toolbar.orderedList")}
        onToggle={commands.toggleOrderedList}
      />
      <ToolbarButton
        icon={QuoteUpIcon}
        isActive={active.blockquote}
        label={t("editor.toolbar.blockquote")}
        onToggle={commands.toggleBlockquote}
      />

      <ToolbarSeparator />

      <LinkPopoverButton editor={editor} isActive={active.link} />
    </BubbleMenu>
  )
}
