import { z } from "zod"

import { isValidTimeZone } from "./streak"

/** Optional IANA time zone sent by clients so study days match their clock. */
export const TimeZoneSchema = z
  .string()
  .max(64)
  .refine(isValidTimeZone, { message: "Unknown time zone" })
  .optional()
