import type { IconId } from "@folionote/editor-core"
import {
  Book02Icon,
  CheckListIcon,
  CodeIcon,
  DivideSignIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  Image02Icon,
  LanguageSquareIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link04Icon,
  QuoteUpIcon,
  Table01Icon,
  Tag01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"

/**
 * Default icon map for slash commands
 * Maps IconId to React components
 */
export const defaultIconMap: Record<IconId, ReactNode> = {
  heading1: <HugeiconsIcon className="size-4" icon={Heading01Icon} />,
  heading2: <HugeiconsIcon className="size-4" icon={Heading02Icon} />,
  heading3: <HugeiconsIcon className="size-4" icon={Heading03Icon} />,
  quote: <HugeiconsIcon className="size-4" icon={QuoteUpIcon} />,
  code: <HugeiconsIcon className="size-4" icon={CodeIcon} />,
  bulletList: (
    <HugeiconsIcon className="size-4" icon={LeftToRightListBulletIcon} />
  ),
  orderedList: (
    <HugeiconsIcon className="size-4" icon={LeftToRightListNumberIcon} />
  ),
  taskList: <HugeiconsIcon className="size-4" icon={CheckListIcon} />,
  divider: <HugeiconsIcon className="size-4" icon={DivideSignIcon} />,
  tag: <HugeiconsIcon className="size-4" icon={Tag01Icon} />,
  ref: <HugeiconsIcon className="size-4" icon={Link04Icon} />,
  source: <HugeiconsIcon className="size-4" icon={Book02Icon} />,
  table: <HugeiconsIcon className="size-4" icon={Table01Icon} />,
  image: <HugeiconsIcon className="size-4" icon={Image02Icon} />,
  japanese: <HugeiconsIcon className="size-4" icon={LanguageSquareIcon} />
}

export type IconMapType = Record<IconId, ReactNode>
