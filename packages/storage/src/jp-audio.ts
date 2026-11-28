import { PutObjectCommand } from "@aws-sdk/client-s3"

import { getS3Client } from "./client"
import { getS3Config, STORAGE_BUCKETS } from "./constants"

/** Pronunciations are stored as MP3 so iOS, Android and browsers all play them. */
export const JP_AUDIO_CONTENT_TYPE = "audio/mpeg"

// Files never change once written (a new voice gets a new path), so clients
// and CDNs may keep them for a year.
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

/** Public URL of a pronunciation stored under `path` in the jp-audio bucket. */
export function getJpAudioUrl(path: string): string {
  return `${getS3Config().publicUrl}/${STORAGE_BUCKETS.JP_AUDIO}/${path}`
}

/** Upload one pronunciation file to the public jp-audio bucket. */
export async function uploadJpAudio(
  path: string,
  body: Uint8Array
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKETS.JP_AUDIO,
      Key: path,
      Body: body,
      ContentType: JP_AUDIO_CONTENT_TYPE,
      CacheControl: IMMUTABLE_CACHE
    })
  )
}
