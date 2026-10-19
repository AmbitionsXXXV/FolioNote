/**
 * Platform seam for dictionary bytes. Must resolve DECOMPRESSED bytes for
 * names like `base.dat.gz`: kuromoji itself never gunzips.
 */
export interface DictionaryLoader {
  loadArrayBuffer(name: string): Promise<ArrayBufferLike>
}
