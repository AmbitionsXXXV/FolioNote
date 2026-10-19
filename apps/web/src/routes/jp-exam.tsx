import { createFileRoute, redirect } from "@tanstack/react-router"

/** Legacy path kept so old links land in the Japanese hub. */
export const Route = createFileRoute("/jp-exam")({
  beforeLoad: () => {
    throw redirect({ to: "/japanese/practice/exam" })
  }
})
