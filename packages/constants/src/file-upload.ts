/**
 * File upload validation constants
 *
 * Shared between server-side (storage/api) and client-side (web/native)
 * for consistent file validation.
 */

/**
 * Supabase Storage bucket names (used as S3 bucket names)
 */
export const STORAGE_BUCKETS = {
  AVATARS: "avatars",
  ATTACHMENTS: "attachments",
  /** Public bucket of pre-generated Japanese pronunciations (word bank only). */
  JP_AUDIO: "jp-audio"
} as const

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

/**
 * Allowed image MIME types for avatar uploads
 */
export const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
] as const

export type AllowedAvatarType = (typeof ALLOWED_AVATAR_TYPES)[number]

/**
 * Maximum file size for avatars (3MB)
 * Supabase has a 50MB limit, but we use 3MB for better UX
 */
export const MAX_AVATAR_SIZE = 3 * 1024 * 1024

/**
 * Allowed image MIME types for entry attachments
 *
 * NOTE: image/svg+xml is intentionally excluded. An SVG can embed <script>, and
 * because attachments are served inline from a public bucket, opening one
 * top-level would execute as stored XSS. Only re-add behind server-side
 * sanitization + a non-executing Content-Disposition.
 */
export const ALLOWED_ATTACHMENT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
] as const

export type AllowedAttachmentImageType =
  (typeof ALLOWED_ATTACHMENT_IMAGE_TYPES)[number]

/**
 * Maximum file size for attachments (10MB)
 */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
