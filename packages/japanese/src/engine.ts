export type EngineId = "kuromoji-ipadic" | "lindera-unidic" | "budoux"

/**
 * Engine-neutral morpheme. Offsets are UTF-16 indexes into the ORIGINAL input
 * so the UI can slice the text it rendered without re-tokenizing.
 * Feature fields use null for "unknown" (IPADIC writes "*").
 */
export interface RawMorpheme {
  surface: string
  start: number
  end: number
  pos: string
  /** Sub-categories in order, without "*" placeholders. */
  posDetail: string[]
  conjugatedType: string | null
  conjugatedForm: string | null
  baseForm: string | null
  /** Katakana reading, null when the dictionary has none. */
  reading: string | null
  pronunciation: string | null
}

export interface EngineCapabilities {
  pos: boolean
  reading: boolean
  lemma: boolean
}

export interface TokenizerEngine {
  id: EngineId
  dictVersion: string
  capabilities: EngineCapabilities
  tokenize(text: string): Promise<RawMorpheme[]>
}
