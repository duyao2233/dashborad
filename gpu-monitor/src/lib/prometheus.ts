export type PromVectorResult = {
  metric: Record<string, string>
  value: [number, string]
}

export type PromMatrixResult = {
  metric: Record<string, string>
  values: [number, string][]
}

export type PromQueryResponse = {
  status: string
  data: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string'
    result: PromVectorResult[] | PromMatrixResult[]
  }
}

const DEFAULT_BASE = '/prometheus'

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

export function getPrometheusBase(): string {
  const fromEnv = import.meta.env.VITE_PROMETHEUS_URL as string | undefined
  return (fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_BASE).replace(
    /\/$/,
    '',
  )
}

export async function promQuery(
  base: string,
  query: string,
  time?: number,
): Promise<PromVectorResult[]> {
  const params = new URLSearchParams({ query })
  if (time != null) params.set('time', String(time))
  const url = `${joinUrl(base, '/api/v1/query')}?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Prometheus query failed: ${res.status}`)
  const body = (await res.json()) as PromQueryResponse
  if (body.status !== 'success') throw new Error('Prometheus query not success')
  if (body.data.resultType !== 'vector')
    throw new Error('Expected vector result')
  return body.data.result as PromVectorResult[]
}

export async function promLabelValues(
  base: string,
  label: string,
  metric: string,
): Promise<string[]> {
  const params = new URLSearchParams({ 'match[]': metric })
  const url = `${joinUrl(base, `/api/v1/label/${encodeURIComponent(label)}/values`)}?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Prometheus label values failed: ${res.status}`)
  const body = (await res.json()) as {
    status: string
    data: string[]
  }
  if (body.status !== 'success') throw new Error('Prometheus label values not success')
  return body.data
}

export async function promQueryRange(
  base: string,
  query: string,
  start: number,
  end: number,
  step: number,
): Promise<PromMatrixResult[]> {
  const params = new URLSearchParams({
    query,
    start: String(start),
    end: String(end),
    step: String(step),
  })
  const url = `${joinUrl(base, '/api/v1/query_range')}?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Prometheus range query failed: ${res.status}`)
  const body = (await res.json()) as PromQueryResponse
  if (body.status !== 'success') throw new Error('Prometheus range not success')
  if (body.data.resultType !== 'matrix')
    throw new Error('Expected matrix result')
  return body.data.result as PromMatrixResult[]
}

export function instanceToIp(instance: string): string {
  const idx = instance.lastIndexOf(':')
  if (idx <= 0) return instance
  return instance.slice(0, idx)
}

export function ipToInstanceRegex(ip: string): string {
  return `${ip.replace(/\./g, '\\.')}:[0-9]+`
}

export function rangeStepSeconds(rangeSeconds: number): number {
  if (rangeSeconds <= 15 * 60) return 15
  if (rangeSeconds <= 60 * 60) return 30
  if (rangeSeconds <= 6 * 60 * 60) return 120
  return 300
}
