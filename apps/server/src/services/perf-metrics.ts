/**
 * In-process request timing metrics.
 *
 * Keeps a bounded reservoir of recent durations per key (an oRPC procedure
 * path or an HTTP route) so `/internal/perf` can report count, error rate and
 * p50/p95/p99 without an external metrics stack. Numbers reset on restart;
 * this is a diagnostic probe for finding slow endpoints, not a durable store.
 */

/** Durations kept per key. Old samples are overwritten ring-buffer style. */
const RESERVOIR_SIZE = 512

interface Series {
  count: number
  errors: number
  maxMs: number
  samples: number[]
  /** Next write slot once the reservoir is full. */
  cursor: number
  lastSeenAt: number
}

export interface SeriesSnapshot {
  key: string
  count: number
  errors: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  maxMs: number
  lastSeenAt: string
}

export interface PerfSnapshot {
  startedAt: string
  uptimeSeconds: number
  series: SeriesSnapshot[]
}

const startedAt = Date.now()
const store = new Map<string, Series>()

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0
  }
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  const index = Math.min(Math.max(rank, 0), sorted.length - 1)
  return sorted[index] ?? 0
}

/** Record one observation. `ok=false` counts the call as an error. */
export function recordTiming(key: string, durationMs: number, ok: boolean) {
  let series = store.get(key)
  if (!series) {
    series = {
      count: 0,
      errors: 0,
      maxMs: 0,
      samples: [],
      cursor: 0,
      lastSeenAt: 0
    }
    store.set(key, series)
  }

  series.count += 1
  if (!ok) {
    series.errors += 1
  }
  series.maxMs = Math.max(series.maxMs, durationMs)
  series.lastSeenAt = Date.now()

  if (series.samples.length < RESERVOIR_SIZE) {
    series.samples.push(durationMs)
  } else {
    series.samples[series.cursor] = durationMs
    series.cursor = (series.cursor + 1) % RESERVOIR_SIZE
  }
}

/** Snapshot sorted by p95 descending so the slowest endpoints come first. */
export function getPerfSnapshot(): PerfSnapshot {
  const series: SeriesSnapshot[] = []

  for (const [key, s] of store) {
    const sorted = s.samples.toSorted((a, b) => a - b)
    series.push({
      key,
      count: s.count,
      errors: s.errors,
      p50Ms: round(percentile(sorted, 50)),
      p95Ms: round(percentile(sorted, 95)),
      p99Ms: round(percentile(sorted, 99)),
      maxMs: round(s.maxMs),
      lastSeenAt: new Date(s.lastSeenAt).toISOString()
    })
  }

  series.sort((a, b) => b.p95Ms - a.p95Ms)

  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    series
  }
}

/** Test helper: drop every series. */
export function resetPerfMetrics() {
  store.clear()
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
