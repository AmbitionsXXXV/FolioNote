import { parseYouTubeVideoId } from "@folionote/utils/youtube"
import { ORPCError } from "@orpc/server"
import { z } from "zod"

import {
  fetchYouTubeVideoInfo,
  YouTubeVideoNotFoundError
} from "../connectors/youtube"
import { protectedProcedure } from "../index"

const VideoInfoInputSchema = z.object({
  /** A pasted link (watch, youtu.be, shorts, embed, live) or a bare video id. */
  url: z.string().trim().min(1).max(2048)
})

/** Title, channel, thumbnail and (with a Data API key) duration for a pasted link. */
const videoInfo = protectedProcedure
  .input(VideoInfoInputSchema)
  .handler(async ({ input }) => {
    const videoId = parseYouTubeVideoId(input.url)
    if (!videoId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Not a YouTube video link"
      })
    }
    try {
      return await fetchYouTubeVideoInfo(videoId)
    } catch (error) {
      if (error instanceof YouTubeVideoNotFoundError) {
        throw new ORPCError("NOT_FOUND", { message: error.message })
      }
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Could not reach YouTube for video details"
      })
    }
  })

export const youtubeRouter = {
  videoInfo
}
