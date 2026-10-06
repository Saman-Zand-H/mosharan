import { useState } from 'react'
import { BarChart3, LineChart, TriangleAlert } from 'lucide-react'

import { Panel } from '../../components/shared/Panel'
import { computeTicks } from '../../lib/chartTicks'
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

const tooltipDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'short',
  timeStyle: 'medium',
})

const maxLabels = 6

export function DashboardChart({ visualization }: { visualization: DashboardVisualization }) {
  const points = visualization.points
  const [hovered, setHovered] = useState<number | null>(null)
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
  const ticks = computeTicks(minWithPadding, maxWithPadding)
  const yFor = (value: number) =>
    bottom - ((value - minWithPadding) / paddedSpan) * (bottom - top)
  const step = (right - left) / Math.max(points.length - 1, 1)
  const plotted = points.map((point, index) => ({
    ...point,
    xPosition: left + index * step,
    yPosition: yFor(point.y),
  }))
  const linePath = plotted
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.xPosition} ${point.yPosition}`)
    .join(' ')
  const areaPath = `${linePath} L ${plotted.at(-1)?.xPosition ?? right} ${bottom} L ${plotted[0]?.xPosition ?? left} ${bottom} Z`
  const labelStep = Math.max(1, Math.ceil(plotted.length / maxLabels))
  const hoveredPoint = hovered !== null ? plotted[hovered] : null

  return (
    <Panel
      className="dashboard-chart-panel"
      title={visualization.title}
      description={`${chartLabels[visualization.chartType]} · X: ${axisLabel(visualization.xAxis)} · Y: ${visualization.yAxis.title}`}
      action={<span className="dashboard-axis-label">{visualization.yAxis.unit ?? visualization.yAxis.code}</span>}
    >
      <div className="dashboard-chart" aria-label={`نمودار ${visualization.title}`}>
        <div className="chart-canvas">
          <svg
            className="dashboard-chart__plot"
            role="img"
            aria-labelledby={titleId}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            <title id={titleId}>{visualization.title}</title>
            {ticks.map((tick) => (
              <line
                key={tick}
                className="dashboard-chart__gridline"
                x1={left}
                x2={right}
                y1={yFor(tick)}
                y2={yFor(tick)}
              />
            ))}
            {hoveredPoint ? (
              <line
                className="dashboard-chart__guide"
                x1={hoveredPoint.xPosition}
                x2={hoveredPoint.xPosition}
                y1={top}
                y2={bottom}
              />
            ) : null}
            {visualization.chartType === 'area' ? <path className="dashboard-chart__area" d={areaPath} /> : null}
            {visualization.chartType === 'bar'
              ? plotted.map((point, index) => {
                  const barWidth = Math.max(8, Math.min(34, step * 0.58))
                  const zeroY =
                    minWithPadding >= 0
                      ? bottom
                      : maxWithPadding <= 0
                        ? top
                        : yFor(0)
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
                className={`dashboard-chart__point${hovered === index ? ' dashboard-chart__point--active' : ''}`}
                cx={point.xPosition}
                cy={point.yPosition}
                r={hovered === index ? 5.5 : 4}
              />
            ))}
            {plotted.map((point, index) => (
              <circle
                key={`${point.observedAt}-hit-${index}`}
                className="dashboard-chart__hit"
                cx={point.xPosition}
                cy={point.yPosition}
                r={12}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div className="chart-y-axis" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} style={{ top: `${(yFor(tick) / height) * 100}%` }}>
                {formatNumber(tick)}
              </span>
            ))}
          </div>
          {hoveredPoint ? (
            <div
              className={`chart-tooltip${hoveredPoint.yPosition < top + 70 ? ' chart-tooltip--below' : ''}`}
              role="status"
              style={{
                left: `${clampPercent((hoveredPoint.xPosition / width) * 100)}%`,
                top: `${(hoveredPoint.yPosition / height) * 100}%`,
              }}
            >
              <b>{formatNumber(hoveredPoint.y)}{visualization.yAxis.unit ? ` ${visualization.yAxis.unit}` : ''}</b>
              <span>{formatTooltipX(hoveredPoint, visualization.xAxis)}</span>
            </div>
          ) : null}
        </div>
        <div className="dashboard-chart__labels" aria-hidden="true">
          {plotted.map((point, index) =>
            index % labelStep === 0 || index === plotted.length - 1 ? (
              <span key={`${point.observedAt}-${index}`} style={{ left: `${(point.xPosition / width) * 100}%` }}>
                {formatX(point.x, point.observedAt, visualization.xAxis)}
              </span>
            ) : null,
          )}
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

function clampPercent(value: number): number {
  return Math.min(88, Math.max(12, value))
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

function formatTooltipX(point: { x: string; observedAt: string }, axis: string): string {
  if (axis !== 'observed_at') {
    return point.x
  }
  const date = new Date(point.observedAt)
  if (!Number.isNaN(date.valueOf())) {
    return tooltipDateFormatter.format(date)
  }
  return point.x
}

function formatNumber(value: number): string {
  return value.toLocaleString('fa-IR', { maximumFractionDigits: 2 })
}
