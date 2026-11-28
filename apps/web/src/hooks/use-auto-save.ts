import { useCallback, useEffect, useRef, useState } from "react"

/**
 * 保存状态类型
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error"

/**
 * 自动保存 hook 配置
 */
export interface UseAutoSaveOptions<T> {
  /** 保存函数 */
  onSave: (data: T) => Promise<void>
  /** 节流延迟（毫秒），默认 1000ms */
  debounceMs?: number
  /** 保存成功后显示 "已保存" 状态的持续时间（毫秒），默认 2000ms */
  savedDurationMs?: number
}

/**
 * 自动保存 hook 返回值
 */
export interface UseAutoSaveReturn<T> {
  /** 当前保存状态 */
  status: SaveStatus
  /** 触发保存（会节流） */
  save: (data: T) => void
  /** 立即保存（不节流） */
  saveImmediately: (data: T) => Promise<void>
  /** 重置状态为 idle */
  reset: () => void
  /** 是否有待保存的更改 */
  isPending: boolean
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Later fields win; non-object payloads are simply replaced. */
function mergePayload<T>(previous: T | null, next: T): T {
  if (isPlainObject(previous) && isPlainObject(next)) {
    return { ...previous, ...next }
  }
  return next
}

/**
 * 自动保存 hook
 *
 * 提供节流的自动保存功能，并跟踪保存状态
 *
 * @example
 * ```tsx
 * const { status, save } = useAutoSave({
 *   onSave: async (data) => {
 *     await api.updateEntry(data)
 *   },
 *   debounceMs: 1000,
 * })
 *
 * // 在内容变化时调用
 * const handleChange = (content: string) => {
 *   save({ id, content })
 * }
 *
 * // 显示保存状态
 * <SaveStatusIndicator status={status} />
 * ```
 */
export function useAutoSave<T>({
  onSave,
  debounceMs = 1000,
  savedDurationMs = 2000
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [isPending, setIsPending] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDataRef = useRef<T | null>(null)
  const isSavingRef = useRef(false)
  // Payload waiting for the debounce timer. Callers pass partial updates
  // ({ title } then { contentJson }), so later calls are merged into it
  // instead of replacing it.
  const debouncedDataRef = useRef<T | null>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  // 清理函数
  const cleanup = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current)
      savedTimeoutRef.current = null
    }
  }, [])

  // 组件卸载时清理；尚未触发的节流保存立即写出，避免丢失最后一次编辑
  useEffect(
    () => () => {
      cleanup()
      const unsaved = debouncedDataRef.current
      debouncedDataRef.current = null
      if (unsaved !== null) {
        onSaveRef.current(unsaved).catch(() => {
          // The component is gone, so there is no status left to update.
        })
      }
    },
    [cleanup]
  )

  // 执行保存
  const executeSave = useCallback(
    async (data: T) => {
      if (isSavingRef.current) {
        // 如果正在保存，记录待保存数据
        pendingDataRef.current = mergePayload(pendingDataRef.current, data)
        return
      }

      isSavingRef.current = true
      setStatus("saving")
      setIsPending(false)

      try {
        await onSave(data)

        // 检查是否有待保存的数据
        if (pendingDataRef.current) {
          const pending = pendingDataRef.current
          pendingDataRef.current = null
          isSavingRef.current = false
          await executeSave(pending)
          return
        }

        setStatus("saved")

        // 一段时间后重置为 idle
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current)
        }
        savedTimeoutRef.current = setTimeout(() => {
          setStatus("idle")
        }, savedDurationMs)
      } catch {
        setStatus("error")
      } finally {
        isSavingRef.current = false
      }
    },
    [onSave, savedDurationMs]
  )

  // 节流保存
  const save = useCallback(
    (data: T) => {
      setIsPending(true)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debouncedDataRef.current = mergePayload(debouncedDataRef.current, data)

      debounceRef.current = setTimeout(() => {
        const merged = debouncedDataRef.current
        debouncedDataRef.current = null
        if (merged !== null) {
          executeSave(merged)
        }
      }, debounceMs)
    },
    [executeSave, debounceMs]
  )

  // 立即保存
  const saveImmediately = useCallback(
    async (data: T) => {
      cleanup()
      const merged = mergePayload(debouncedDataRef.current, data)
      debouncedDataRef.current = null
      await executeSave(merged)
    },
    [cleanup, executeSave]
  )

  // 重置状态
  const reset = useCallback(() => {
    cleanup()
    setStatus("idle")
    setIsPending(false)
    pendingDataRef.current = null
    debouncedDataRef.current = null
    isSavingRef.current = false
  }, [cleanup])

  return {
    status,
    save,
    saveImmediately,
    reset,
    isPending
  }
}
