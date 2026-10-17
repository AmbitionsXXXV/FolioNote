export interface PMMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  marks?: PMMark[]
  text?: string
}

export interface PMDoc extends PMNode {
  type: "doc"
  content: PMNode[]
}

/** Lossy conversions, aggregated by kind for the import preview. */
export interface ImportWarning {
  kind: string
  from: string
  to: string
  count: number
}

export interface ImportedDoc {
  title: string
  doc: PMDoc
  warnings: ImportWarning[]
  /** Expiring image URLs the caller must re-host. */
  assetUrls: string[]
}

export interface ConvertOptions {
  /** Rewrite image sources; defaults to identity. */
  mapImageUrl?: (url: string) => string
}
