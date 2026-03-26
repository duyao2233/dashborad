import { useEffect, useRef } from 'react'
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts'

type GpuChartProps = {
  points: LineData[]
  color: string
}

export function GpuChart({ points, color }: GpuChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(192,132,252,0.35)' },
        horzLine: { color: 'rgba(192,132,252,0.35)' },
      },
      handleScroll: false,
      handleScale: false,
    })

    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      priceFormat: { type: 'percent', minMove: 0.1, precision: 1 },
    })
    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect()
      chart.applyOptions({ width, height })
    })
    ro.observe(el)
    const { width, height } = el.getBoundingClientRect()
    chart.applyOptions({ width, height })

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [color])

  useEffect(() => {
    const s = seriesRef.current
    if (!s) return
    const data = points.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }))
    s.setData(data)
    chartRef.current?.timeScale().fitContent()
  }, [points])

  return <div className="gpu-chart" ref={wrapRef} />
}
