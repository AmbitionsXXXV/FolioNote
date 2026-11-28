import { FileEditIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"

interface MentionBadgeProps {
  title: string
  className?: string
  variant?: "default" | "message" | "user-message"
}

export function MentionBadge({
  title,
  className,
  variant = "default"
}: MentionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-px",
        "align-middle font-medium text-xs leading-tight",
        // Default variant (for input box)
        variant === "default" && [
          "bg-primary/15 text-primary",
          "border border-primary/25"
        ],
        // Message variant for user messages (light background on dark primary)
        variant === "user-message" && [
          "bg-primary/15 text-primary",
          "border border-primary-foreground/30",
          "text-[11px]"
        ],
        // Message variant for assistant or general messages
        variant === "message" && [
          "bg-primary/15 text-primary",
          "border border-primary/25",
          "text-[11px]"
        ],
        className
      )}
    >
      <HugeiconsIcon className="size-3 shrink-0" icon={FileEditIcon} />
      <span
        className={cn(
          "truncate",
          variant === "default" && "max-w-[100px]",
          (variant === "message" || variant === "user-message") &&
            "max-w-[180px]"
        )}
      >
        {title}
      </span>
    </span>
  )
}

/**
 * Parse text and render @ mentions as badges based on known mention titles
 * @param text - The text to parse
 * @param variant - The badge variant to use
 * @param knownMentions - Optional array of known mention titles to match against
 */
export function renderTextWithMentions(
  text: string,
  variant: "default" | "message" | "user-message" = "default",
  knownMentions?: string[]
): React.ReactNode {
  // If we have known mentions, match against them specifically
  if (knownMentions && knownMentions.length > 0) {
    return renderWithKnownMentions(text, variant, knownMentions)
  }

  // Fallback: match @mentions pattern - either @"title with spaces" or @word
  const mentionRegex = /@"([^"]+)"|@(\S+)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  const matches = [...text.matchAll(mentionRegex)]

  for (const match of matches) {
    // Add text before the mention
    if (match.index !== undefined && match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    // Add the mention badge - match[1] is quoted, match[2] is unquoted
    const mentionTitle = match[1] ?? match[2] ?? ""
    if (mentionTitle) {
      parts.push(
        <MentionBadge
          key={`mention-${match.index}`}
          title={mentionTitle}
          variant={variant}
        />
      )
    }

    if (match.index !== undefined) {
      lastIndex = match.index + match[0].length
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

/**
 * Render text with known mention titles highlighted
 */
function renderWithKnownMentions(
  text: string,
  variant: "default" | "message" | "user-message",
  knownMentions: string[]
): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIndex = 0

  while (remaining.length > 0) {
    // Find the earliest matching mention in the remaining text
    let earliestMatch: { index: number; title: string } | null = null

    for (const title of knownMentions) {
      const pattern = `@${title}`
      const index = remaining.indexOf(pattern)
      if (
        index !== -1 &&
        (earliestMatch === null || index < earliestMatch.index)
      ) {
        earliestMatch = { index, title }
      }
    }

    if (earliestMatch === null) {
      // No more mentions found, add remaining text
      parts.push(remaining)
      break
    }

    // Add text before the mention
    if (earliestMatch.index > 0) {
      parts.push(remaining.slice(0, earliestMatch.index))
    }

    // Add the mention badge
    parts.push(
      <MentionBadge
        key={`mention-${keyIndex++}`}
        title={earliestMatch.title}
        variant={variant}
      />
    )

    // Move past the matched mention
    remaining = remaining.slice(
      earliestMatch.index + 1 + earliestMatch.title.length
    )
  }

  return parts.length > 0 ? parts : text
}
