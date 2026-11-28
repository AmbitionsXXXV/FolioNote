import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { useAutoSave } from "@/hooks/use-auto-save"

interface Payload {
  id: string
  title?: string
  contentJson?: string
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("merges partial payloads queued inside one debounce window", async () => {
    const onSave = vi.fn(async (_data: Payload) => {})
    const { result } = renderHook(() =>
      useAutoSave<Payload>({ onSave, debounceMs: 1000 })
    )

    act(() => {
      result.current.save({ id: "a", title: "New title" })
      result.current.save({ id: "a", contentJson: "{}" })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      id: "a",
      title: "New title",
      contentJson: "{}"
    })
  })

  it("flushes a pending save when the component unmounts", () => {
    const onSave = vi.fn(async (_data: Payload) => {})
    const { result, unmount } = renderHook(() =>
      useAutoSave<Payload>({ onSave, debounceMs: 1000 })
    )

    act(() => {
      result.current.save({ id: "a", title: "Unsaved" })
    })
    unmount()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ id: "a", title: "Unsaved" })
  })

  it("does not save on unmount when nothing is pending", async () => {
    const onSave = vi.fn(async (_data: Payload) => {})
    const { result, unmount } = renderHook(() =>
      useAutoSave<Payload>({ onSave, debounceMs: 1000 })
    )

    act(() => {
      result.current.save({ id: "a", title: "Saved" })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    unmount()

    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
