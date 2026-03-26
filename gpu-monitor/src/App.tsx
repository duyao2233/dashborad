import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LineData } from 'lightweight-charts'
import { GpuChart } from './components/GpuChart'
import {
  getPrometheusBase,
  instanceToIp,
  ipToInstanceRegex,
  promLabelValues,
  promQuery,
  promQueryRange,
  rangeStepSeconds,
  type PromMatrixResult,
  type PromVectorResult,
} from './lib/prometheus'
import './App.css'

const GPU_METRIC = 'DCGM_FI_DEV_GPU_UTIL'
const RANGE_OPTIONS = [
  { label: '1 小时', seconds: 3600 },
  { label: '6 小时', seconds: 6 * 3600 },
  { label: '24 小时', seconds: 24 * 3600 },
] as const

type GpuSeries = {
  key: string
  node: string
  gpu: string
  instance: string
  ip: string
  current: number | null
  min: number | null
  max: number | null
  mean: number | null
  points: LineData[]
}

function metricMatcher(instanceIp: string | null): string {
  if (!instanceIp) return ''
  const re = ipToInstanceRegex(instanceIp)
  return `{instance=~"${re}"}`
}

function parseVector(rows: PromVectorResult[]): GpuSeries[] {
  const list: GpuSeries[] = []
  for (const r of rows) {
    const m = r.metric
    const node = m.node ?? m.Hostname ?? 'unknown'
    const gpu = m.gpu ?? '?'
    const instance = m.instance ?? ''
    const v = parseFloat(r.value[1])
    list.push({
      key: `${instance}|${node}|${gpu}`,
      node,
      gpu,
      instance,
      ip: instanceToIp(instance),
      current: Number.isFinite(v) ? v : null,
      min: null,
      max: null,
      mean: null,
      points: [],
    })
  }
  list.sort((a, b) => {
    const nc = a.node.localeCompare(b.node, 'en')
    if (nc !== 0) return nc
    const ga = parseInt(a.gpu, 10)
    const gb = parseInt(b.gpu, 10)
    if (!Number.isNaN(ga) && !Number.isNaN(gb)) return ga - gb
    return a.gpu.localeCompare(b.gpu, 'en')
  })
  return list
}

function mergeHistory(
  base: GpuSeries[],
  matrix: PromMatrixResult[],
): GpuSeries[] {
  const hist = new Map<string, PromMatrixResult>()
  for (const row of matrix) {
    const m = row.metric
    const instance = m.instance ?? ''
    const node = m.node ?? m.Hostname ?? 'unknown'
    const gpu = m.gpu ?? '?'
    hist.set(`${instance}|${node}|${gpu}`, row)
  }
  return base.map((s) => {
    const row = hist.get(s.key)
    if (!row || row.values.length === 0) return { ...s, points: [] as LineData[] }
    const nums: number[] = []
    const points: LineData[] = []
    for (const [ts, valStr] of row.values) {
      const val = parseFloat(valStr)
      if (!Number.isFinite(val)) continue
      nums.push(val)
      points.push({ time: ts as LineData['time'], value: val })
    }
    if (nums.length === 0) return { ...s, points: [] }
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    return { ...s, min, max, mean, points }
  })
}

function colorForKey(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 65% 58%)`
}

export default function App() {
  const base = useMemo(() => getPrometheusBase(), [])
  const [instanceIps, setInstanceIps] = useState<string[]>([])
  const [ipFilter, setIpFilter] = useState<string>('all')
  const [rangeIdx, setRangeIdx] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [series, setSeries] = useState<GpuSeries[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const rangeSeconds = RANGE_OPTIONS[rangeIdx].seconds

  const loadIps = useCallback(async () => {
    try {
      const instances = await promLabelValues(base, 'instance', GPU_METRIC)
      const ips = Array.from(
        new Set(instances.map((i) => instanceToIp(i)).filter(Boolean)),
      ).sort()
      setInstanceIps(ips)
    } catch {
      setInstanceIps([])
    }
  }, [base])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const ip = ipFilter === 'all' ? null : ipFilter
    const m = metricMatcher(ip)
    const q = `${GPU_METRIC}${m}`
    const end = Date.now() / 1000
    const start = end - rangeSeconds
    const step = rangeStepSeconds(rangeSeconds)
    try {
      const [vec, mat] = await Promise.all([
        promQuery(base, q),
        promQueryRange(base, q, start, end, step),
      ])
      const parsed = parseVector(vec)
      setSeries(mergeHistory(parsed, mat))
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSeries([])
    } finally {
      setLoading(false)
    }
  }, [base, ipFilter, rangeSeconds])

  useEffect(() => {
    void loadIps()
  }, [loadIps])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const nodesGrouped = useMemo(() => {
    const map = new Map<string, GpuSeries[]>()
    for (const s of series) {
      const arr = map.get(s.node) ?? []
      arr.push(s)
      map.set(s.node, arr)
    }
    return map
  }, [series])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>GPU 监控</h1>
          <p className="app-sub">
            Prometheus 指标 <code>DCGM_FI_DEV_GPU_UTIL</code>，按节点与 GPU
            展示当前利用率与历史曲线。
          </p>
        </div>
        <div className="toolbar">
          <label className="field">
            <span>节点 IP（instance）</span>
            <select
              value={ipFilter}
              onChange={(e) => setIpFilter(e.target.value)}
              disabled={loading}
            >
              <option value="all">全部</option>
              {instanceIps.map((ip) => (
                <option key={ip} value={ip}>
                  {ip}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>历史范围</span>
            <select
              value={rangeIdx}
              onChange={(e) => setRangeIdx(Number(e.target.value))}
              disabled={loading}
            >
              {RANGE_OPTIONS.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
        </div>
        {lastRefresh && (
          <p className="meta">
            上次更新：{lastRefresh.toLocaleString()}
            {error && <span className="err"> · {error}</span>}
          </p>
        )}
      </header>

      {!loading && series.length === 0 && !error && (
        <p className="empty">暂无 GPU 数据。</p>
      )}

      <div className="nodes">
        {Array.from(nodesGrouped.entries()).map(([node, rows]) => (
          <section key={node} className="node-block">
            <h2 className="node-title">
              <span className="node-name">{node}</span>
              <span className="node-ip">{rows[0]?.ip}</span>
            </h2>
            <div className="gpu-grid">
              {rows.map((g) => (
                <article key={g.key} className="gpu-card">
                  <div className="gpu-card-head">
                    <span className="gpu-id">GPU {g.gpu}</span>
                    <span
                      className="gpu-current"
                      title="当前 GPU 利用率（瞬时）"
                    >
                      {g.current != null ? `${g.current.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="gpu-stats">
                    <span title="时间范围内最小值">
                      低 {g.min != null ? `${g.min.toFixed(1)}%` : '—'}
                    </span>
                    <span title="时间范围内最大值">
                      高 {g.max != null ? `${g.max.toFixed(1)}%` : '—'}
                    </span>
                    <span title="时间范围内平均">
                      均 {g.mean != null ? `${g.mean.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <GpuChart points={g.points} color={colorForKey(g.key)} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
