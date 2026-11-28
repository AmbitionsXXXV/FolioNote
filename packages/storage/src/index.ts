// Client

// Attachment operations
export {
  deleteAttachment,
  type UploadAttachmentOptions,
  type UploadAttachmentResult,
  uploadAttachment,
  validateAttachmentFile
} from "./attachment"

// Avatar operations
export {
  deleteAvatar,
  deleteUserAvatars,
  getPathFromPublicUrl,
  type UploadAvatarOptions,
  type UploadAvatarResult,
  uploadAvatar,
  validateAvatarFile
} from "./avatar"
export { getS3Client, resetS3Client } from "./client"

// Pre-generated Japanese pronunciations
export { getJpAudioUrl, JP_AUDIO_CONTENT_TYPE, uploadJpAudio } from "./jp-audio"

// Constants
export {
  ALLOWED_ATTACHMENT_IMAGE_TYPES,
  ALLOWED_AVATAR_TYPES,
  type AllowedAttachmentImageType,
  type AllowedAvatarType,
  getDefaultS3Endpoint,
  getS3Config,
  MAX_ATTACHMENT_SIZE,
  MAX_AVATAR_SIZE,
  STORAGE_BUCKETS,
  type StorageBucket
} from "./constants"
