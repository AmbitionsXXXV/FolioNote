/**
 * AES-256-GCM for third-party OAuth tokens at rest (external_connections).
 *
 * WebCrypto rather than node:crypto so this module stays importable from any
 * runtime that loads @folionote/api. The key is derived with HKDF from
 * CONNECTOR_TOKEN_SECRET, falling back to BETTER_AUTH_SECRET — rotating
 * either secret makes stored tokens undecryptable, which surfaces as
 * "reconnect Notion", never as silently wrong data.
 *
 * Format: `v1.<base64url iv>.<base64url ciphertext+tag>`
 */

const VERSION = "v1"
const IV_BYTES = 12
const HKDF_INFO = "folionote/external-connections/v1"

let keyPromise: Promise<CryptoKey> | null = null

function readSecret(): string {
  const secret =
    process.env.CONNECTOR_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error(
      "CONNECTOR_TOKEN_SECRET or BETTER_AUTH_SECRET must be set to store connector tokens"
    )
  }
  return secret
}

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const material = new TextEncoder().encode(readSecret())
    keyPromise = crypto.subtle
      .importKey("raw", material, "HKDF", false, ["deriveKey"])
      .then((base) =>
        crypto.subtle.deriveKey(
          {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(0),
            info: new TextEncoder().encode(HKDF_INFO)
          },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        )
      )
  }
  return keyPromise
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url")
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, "base64url"))
}

export async function encryptToken(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getKey(),
    new TextEncoder().encode(plaintext)
  )
  return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`
}

export async function decryptToken(sealed: string): Promise<string> {
  const [version, iv, data] = sealed.split(".")
  if (version !== VERSION || !iv || !data) {
    throw new Error("Unrecognized connector token format")
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    await getKey(),
    fromBase64Url(data)
  )
  return new TextDecoder().decode(plaintext)
}
