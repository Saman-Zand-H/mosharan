import { BarChart3, LineChart, TriangleAlert } from 'lucide-react'

import { Panel } from '../../components/shared/Panel'
import type { DashboardVisualization } from './dashboardApi'

const width = 760
const height = 260
const left = 52
const right = 738
const top = 24
const bottom = 202

const chartLabels: Record<DashboardVisualization['chartType'], string> = {
  line: 'خطی',
  area: 'ناحیه‌ای',
  bar: 'میله‌ای',
}

export function DashboardChart({ visualization }: { visualization: DashboardVisualization }) {
  const points = visualization.points
  const Icon = visualization.chartType === 'bar' ? BarChart3 : LineChart
  const titleId = `dashboard-chart-${visualization.id}-title`

  if (!points.length) {
    return (
      <Panel
        className="dashboard-chart-panel"
        title={visualization.title}
        description={`${chartLabels[visualization.chartType]} · Y: ${visualization.yAxis.title}`}
        action={<span className="dashboard-axis-label">بدون داده</span>}
      >
        <div className="dashboard-chart-empty" role="status">
          <TriangleAlert size={22} aria-hidden="true" />
          <span>برای این بازه خوانشی ثبت نشده است.</span>
        </div>
      </Panel>
    )
  }

  const values = points.map((point) => point.y)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const span = maxValue - minValue || 1
  const maxWithPadding = maxValue + span * 0.08
  const minWithPadding = minValue - span * 0.08
  const paddedSpan = maxWithPadding - minWithPadding || 1
  const step = (right - left) / Math.max(points.length - 1, 1)
  const plotted = points.map((point, index) => ({
    ...point,
    xPosition: left + index * step,
    yPosition: bottom - ((point.y - minWithPadding) / paddedSpan) * (bottom - top),
  }))
  const linePath = plotted
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.xPosition} ${point.yPosition}`)
    .join(' ')
  const areaPath = `${linePath} L ${plotted.at(-1)?.xPosition ?? right} ${bottom} L ${plotted[0]?.xPosition ?? left} ${bottom} Z`

  return (
    <Panel
      className="dashboard-chart-panel"
      title={visualization.title}
      description={`${chartLabels[visualization.chartType]} · X: ${axisLabel(visualization.xAxis)} · Y: ${visualization.yAxis.title}`}
      action={<span className="dashboard-axis-label">{visualization.yAxis.unit ?? visualization.yAxis.code}</span>}
    >
      <div className="dashboard-chart" aria-label={`نمودار ${visualization.title}`}>
        <svg
          className="dashboard-chart__plot"
          role="img"
          aria-labelledby={titleId}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <title id={titleId}>{visualization.title}</title>
          {[top, top + 59, top + 118, bottom].map((y) => (
            <line key={y} className="dashboard-chart__gridline" x1={left} x2={right} y1={y} y2={y} />
          ))}
          {visualization.chartType === 'area' ? <path className="dashboard-chart__area" d={areaPath} /> : null}
          {visualization.chartType === 'bar'
            ? plotted.map((point, index) => {
                const barWidth = Math.max(8, Math.min(34, step * 0.58))
                const zeroY =
                  minWithPadding >= 0
                    ? bottom
                    : maxWithPadding <= 0
                      ? top
                      : bottom - ((0 - minWithPadding) / paddedSpan) * (bottom - top)
                const yStart = point.y >= 0 ? point.yPosition : zeroY
                const barHeight = Math.max(2, Math.abs(zeroY - point.yPosition))
                return (
                  <rect
                    key={`${point.observedAt}-${index}`}
                    className="dashboard-chart__bar"
                    x={point.xPosition - barWidth / 2}
                    y={yStart}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                  />
                )
              })
            : <path className="dashboard-chart__line" d={linePath} />}
          {plotted.map((point, index) => (
            <circle
              key={`${point.observedAt}-${index}`}
              className="dashboard-chart__point"
              cx={point.xPosition}
              cy={point.yPosition}
              r="4"
            />
          ))}
        </svg>
        <div className="dashboard-chart__labels" aria-hidden="true">
          {plotted.map((point, index) => (
            <span key={`${point.observedAt}-${index}`}>{formatX(point.x, point.observedAt, visualization.xAxis)}</span>
          ))}
        </div>
      </div>
      <div className="dashboard-chart__summary">
        <span>کمینه <strong>{formatNumber(minValue)}</strong></span>
        <span>بیشینه <strong>{formatNumber(maxValue)}</strong></span>
        <span>{points.length.toLocaleString('fa-IR')} نقطه</span>
        <Icon size={15} aria-hidden="true" />
      </div>
    </Panel>
  )
}

function axisLabel(axis: string): string {
  return axis === 'observed_at' ? 'زمان مشاهده' : axis
}

function formatX(value: string, observedAt: string, axis: string): string {
  if (axis !== 'observed_at') {
    return value.length > 12 ? `${value.slice(0, 12)}…` : value
  }
  const date = new Date(observedAt)
  if (!Number.isNaN(date.valueOf())) {
    return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return value.length > 12 ? `${value.slice(0, 12)}…` : value
}

function formatNumber(value: number): string {
  return value.toLocaleString('fa-IR', { maximumFractionDigits: 2 })
}
