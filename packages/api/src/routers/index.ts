import type { RouterClient } from "@orpc/server"

import { protectedProcedure, publicProcedure } from "../index"
import { aiRouter } from "./ai"
import { entriesRouter } from "./entries"
import { entryCollaboratorsRouter } from "./entry-collaborators"
import { graphRouter } from "./graph"
import { importsRouter } from "./imports"
import { japaneseRouter } from "./japanese"
import { reviewRouter } from "./review"
import { searchRouter } from "./search"
import { sharesRouter } from "./shares"
import { sourcesRouter } from "./sources"
import { storageRouter } from "./storage"
import { tagsRouter } from "./tags"

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user
  })),
  ai: aiRouter,
  entries: entriesRouter,
  collaborators: entryCollaboratorsRouter,
  graph: graphRouter,
  tags: tagsRouter,
  sources: sourcesRouter,
  search: searchRouter,
  review: reviewRouter,
  shares: sharesRouter,
  storage: storageRouter,
  japanese: japaneseRouter,
  imports: importsRouter
}
export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<typeof appRouter>
