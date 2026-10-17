import { COLLAB_SCHEMA_EXTENSIONS } from "@folionote/editor-core/collab"
import { getSchema } from "@tiptap/core"

import type { PMDoc } from "./types"

let schema: ReturnType<typeof getSchema> | undefined

export function getImportSchema(): ReturnType<typeof getSchema> {
  schema ??= getSchema(COLLAB_SCHEMA_EXTENSIONS)
  return schema
}

export function assertValidDoc(doc: PMDoc): void {
  try {
    if (doc.type !== "doc") {
      throw new Error("Root node must be a doc")
    }
    getImportSchema().nodeFromJSON(doc).check()
  } catch (error) {
    throw new Error(
      `Invalid imported document: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

export function emptyDoc(): PMDoc {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] }
}
