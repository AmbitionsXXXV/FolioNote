import { beforeEach, describe, expect, it } from "vite-plus/test"

import {
  getPerfSnapshot,
  recordTiming,
  resetPerfMetrics
} from "../src/services/perf-metrics"

describe("perf-metrics", () => {
  beforeEach(() => {
    resetPerfMetrics()
  })

  it("computes count, errors and percentiles per key", () => {
    for (let ms = 1; ms <= 100; ms++) {
      recordTiming("rpc.entries.list", ms, true)
    }
    recordTiming("rpc.entries.list", 500, false)

    const [series] = getPerfSnapshot().series
    expect(series?.key).toBe("rpc.entries.list")
    expect(series?.count).toBe(101)
    expect(series?.errors).toBe(1)
    expect(series?.p50Ms).toBe(51)
    expect(series?.p95Ms).toBe(96)
    expect(series?.maxMs).toBe(500)
  })

  it("orders series by p95 descending", () => {
    recordTiming("fast", 5, true)
    recordTiming("slow", 900, true)
    recordTiming("medium", 50, true)

    expect(getPerfSnapshot().series.map((s) => s.key)).toEqual([
      "slow",
      "medium",
      "fast"
    ])
  })

  it("keeps max across samples that fell out of the reservoir", () => {
    recordTiming("k", 9999, true)
    for (let i = 0; i < 600; i++) {
      recordTiming("k", 1, true)
    }
    const [series] = getPerfSnapshot().series
    expect(series?.count).toBe(601)
    expect(series?.maxMs).toBe(9999)
    expect(series?.p99Ms).toBe(1)
  })
})
