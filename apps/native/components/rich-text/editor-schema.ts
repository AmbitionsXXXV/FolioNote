import { CustomLink } from "@folionote/editor-core"
import { COLLAB_SCHEMA_EXTENSIONS } from "@folionote/editor-core/collab"

/**
 * The web editor's full document schema (tables, images, code languages,
 * fold state, sentence blocks, source ids), from the DOM-free mirror the
 * collab server uses. The native editor used to parse entries with
 * StarterKit only, which silently dropped every table and image — and the
 * next autosave wrote the stripped document back.
 *
 * The mirror's plain Link is swapped for the hardened CustomLink (same
 * extension name, so never both).
 */
export const RICH_TEXT_SCHEMA_EXTENSIONS = [
  ...COLLAB_SCHEMA_EXTENSIONS.filter((extension) => extension.name !== "link"),
  CustomLink
]
