import { TokenizerBuilder } from "@patdx/kuromoji"
import type { IpadicFeatures } from "@patdx/kuromoji"

import type { RawMorpheme, TokenizerEngine } from "./engine"
import { JapaneseAnalyzerError } from "./errors"
import { emptyTargetMapBuffer, installCompactTargetMap } from "./kuromoji-dict"
import type { DictionaryLoader } from "./loaders/types"

export type { DictionaryLoader } from "./loaders/types"

export const KUROMOJI_IPADIC_DICT_VERSION =
  "mecab-ipadic-2.7.0-20070801+@patdx/kuromoji@1.0.4"

export interface KuromojiEngineOptions {
  loader: DictionaryLoader
  dictVersion?: string
}

function feature(value: string | undefined): string | null {
  if (value === undefined || value === "" || value === "*") return null
  return value
}

/**
 * kuromoji's word_position counts code points (𠮷 advances it by 1), so UTF-16
 * offsets are rebuilt by walking surfaces through the original text.
 */
function toRawMorphemes(text: string, tokens: IpadicFeatures[]): RawMorpheme[] {
  let cursor = 0
  return tokens.map((token) => {
    const surface = token.surface_form
    const start = text.startsWith(surface, cursor)
      ? cursor
      : text.indexOf(surface, cursor)
    if (start === -1) {
      throw new Error(
        `kuromoji token "${surface}" not found in input after offset ${cursor}`
      )
    }
    cursor = start + surface.length
    return {
      baseForm: feature(token.basic_form),
      conjugatedForm: feature(token.conjugated_form),
      conjugatedType: feature(token.conjugated_type),
      end: cursor,
      pos: token.pos,
      posDetail: [token.pos_detail_1, token.pos_detail_2, token.pos_detail_3]
        .map(feature)
        .filter((detail) => detail !== null),
      pronunciation: feature(token.pronunciation),
      reading: feature(token.reading),
      start,
      surface
    }
  })
}

export async function createKuromojiEngine({
  loader,
  dictVersion = KUROMOJI_IPADIC_DICT_VERSION
}: KuromojiEngineOptions): Promise<TokenizerEngine> {
  let tokenizer: Awaited<ReturnType<TokenizerBuilder["build"]>>
  try {
    // kuromoji turns tid_map into a large JS object; hand it an empty one and
    // install the compact typed-array map from the real bytes afterwards.
    let tidMap: ArrayBufferLike | null = null
    tokenizer = await new TokenizerBuilder({
      loader: {
        async loadArrayBuffer(name) {
          if (name !== "tid_map.dat.gz") return loader.loadArrayBuffer(name)
          tidMap = await loader.loadArrayBuffer(name)
          return emptyTargetMapBuffer()
        }
      }
    }).build()
    if (!tidMap) throw new Error("kuromoji did not request tid_map.dat.gz")
    installCompactTargetMap(tokenizer, new Uint8Array(tidMap))
  } catch (error) {
    throw new JapaneseAnalyzerError(
      "ENGINE_UNAVAILABLE",
      "Failed to load the kuromoji IPADIC dictionary",
      { cause: error }
    )
  }

  return {
    capabilities: { lemma: true, pos: true, reading: true },
    dictVersion,
    id: "kuromoji-ipadic",
    tokenize: async (text) => toRawMorphemes(text, tokenizer.tokenize(text))
  }
}
