// Memory reductions for @patdx/kuromoji 1.0.4's IPADIC dictionary. Pure TS with
// no imports, so the build script can load it with Node's type stripping and it
// stays usable in browsers and Hermes. Measured (Linux, Node 24): +424 MB RSS
// per process with the stock files → +99 MB with trimmed raw files plus the
// compact target map, token-for-token identical on 167,803 tokens.

/** The 12 files kuromoji's DictionaryLoader requests, by the names it uses. */
export const KUROMOJI_DICT_FILES = [
  "base.dat.gz",
  "check.dat.gz",
  "tid.dat.gz",
  "tid_pos.dat.gz",
  "tid_map.dat.gz",
  "cc.dat.gz",
  "unk.dat.gz",
  "unk_pos.dat.gz",
  "unk_map.dat.gz",
  "unk_char.dat.gz",
  "unk_compat.dat.gz",
  "unk_invoke.dat.gz"
] as const

/** Trimmed files are stored uncompressed under the name without `.gz`. */
export const trimmedFileName = (name: string): string =>
  name.endsWith(".gz") ? name.slice(0, -3) : name

// Typed views with fixed semantic lengths; small, so left as shipped.
const UNTOUCHED = new Set(["cc.dat.gz", "unk_char.dat.gz", "unk_compat.dat.gz"])
const SLACK_BYTES = 16

function lastNonZero(bytes: Uint8Array): number {
  let index = bytes.length - 1
  while (index >= 0 && bytes[index] === 0) index--
  return index + 1
}

/**
 * Logical length of the double array. Cells past it hold the builder's
 * "unused" pattern (negative check), which is exactly what kuromoji returns
 * for out-of-range reads, so dropping them changes no lookup.
 */
function doubleArrayLength(checkBytes: Uint8Array): number {
  const check = new Int32Array(
    checkBytes.buffer,
    checkBytes.byteOffset,
    Math.floor(checkBytes.byteLength / Int32Array.BYTES_PER_ELEMENT)
  )
  let last = check.length - 1
  while (last >= 0 && (check[last] ?? 0) < 0) last--
  return last + 2
}

/**
 * Drops the zero padding the shipped files carry (~41% of 95.6 MiB). The
 * ByteBuffer readers return 0 past the end, so a zero tail is redundant; 4-byte
 * alignment plus a little slack is kept. Input: decompressed bytes by the
 * names in KUROMOJI_DICT_FILES. Output: bytes by trimmedFileName().
 */
export function trimKuromojiDictionary(
  files: ReadonlyMap<string, Uint8Array>
): Map<string, Uint8Array> {
  const check = files.get("check.dat.gz")
  if (!check) {
    throw new Error("check.dat.gz is required to trim the double array")
  }
  const daLength = doubleArrayLength(check)
  const trimmed = new Map<string, Uint8Array>()
  for (const [name, bytes] of files) {
    let kept = bytes.byteLength
    if (name === "base.dat.gz" || name === "check.dat.gz") {
      kept = daLength * 4
    } else if (!UNTOUCHED.has(name)) {
      kept = Math.min(
        bytes.byteLength,
        Math.ceil(lastNonZero(bytes) / 4) * 4 + SLACK_BYTES
      )
    }
    trimmed.set(trimmedFileName(name), bytes.slice(0, kept))
  }
  return trimmed
}

/** A tid_map with zero entries: kuromoji then builds an empty JS object. */
export const emptyTargetMapBuffer = (): ArrayBuffer => new ArrayBuffer(4)

interface TokenizerWithTargetMap {
  token_info_dictionary: { target_map: unknown }
}

/**
 * Replaces kuromoji's tid_map JS object (~70 MB of heap) with typed arrays
 * behind a Proxy that returns the same per-key id lists. Relies on the
 * internal `token_info_dictionary.target_map` of @patdx/kuromoji 1.0.4, which
 * is pinned exactly for this reason.
 * Layout: [count] then repeated [key, n, v1..vn], all int32 little-endian.
 */
export function installCompactTargetMap(
  tokenizer: unknown,
  tidMap: Uint8Array
): void {
  const view = new DataView(tidMap.buffer, tidMap.byteOffset, tidMap.byteLength)
  let maxKey = -1
  let total = 0
  for (let p = 4; p + 8 <= tidMap.byteLength;) {
    const key = view.getInt32(p, true)
    const n = view.getInt32(p + 4, true)
    p += 8 + 4 * n
    if (n > 0) {
      maxKey = Math.max(maxKey, key)
      total += n
    }
  }
  const count = new Int32Array(maxKey + 1)
  for (let p = 4; p + 8 <= tidMap.byteLength;) {
    const key = view.getInt32(p, true)
    const n = view.getInt32(p + 4, true)
    p += 8 + 4 * n
    if (n > 0) count[key] = (count[key] ?? 0) + n
  }
  const start = new Int32Array(maxKey + 2)
  for (let key = 0; key <= maxKey; key++) {
    start[key + 1] = (start[key] ?? 0) + (count[key] ?? 0)
  }
  const fill = start.slice(0, maxKey + 1)
  const values = new Int32Array(total)
  for (let p = 4; p + 8 <= tidMap.byteLength;) {
    const key = view.getInt32(p, true)
    const n = view.getInt32(p + 4, true)
    p += 8
    for (let i = 0; i < n; i++) {
      const slot = fill[key] ?? 0
      values[slot] = view.getInt32(p + 4 * i, true)
      fill[key] = slot + 1
    }
    p += 4 * n
  }

  const compact = new Proxy(
    {},
    {
      get(_target, property) {
        const key = Number(property)
        if (!(key >= 0 && key <= maxKey) || count[key] === 0) return undefined
        return values.subarray(start[key], start[key + 1])
      }
    }
  )
  ;(tokenizer as TokenizerWithTargetMap).token_info_dictionary.target_map =
    compact
}
