import type { ChartPoint } from '../../types'
import { Panel } from '../shared/Panel'

const chartWidth = 720
const chartHeight = 226
const chartTop = 18
const chartBottom = 185
const chartLeft = 34
const chartRight = 704

function createPoints(data: ChartPoint[]) {
  const maxValue = Math.max(...data.map((point) => point.processed)) * 1.08
  const step = (chartRight - chartLeft) / Math.max(data.length - 1, 1)

  return data.map((point, index) => ({
    ...point,
    x: chartLeft + index * step,
    y:
      chartBottom -
      (point.processed / maxValue) * (chartBottom - chartTop),
  }))
}

export function EventVolumeChart({ data }: { data: ChartPoint[] }) {
  const points = createPoints(data)
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? chartRight} ${chartBottom} L ${points[0]?.x ?? chartLeft} ${chartBottom} Z`
  const failedTotal = data.reduce((sum, point) => sum + point.failed, 0)

  return (
    <Panel
      className="volume-panel"
      title="جریان رویدادها"
      description="تعداد پیام‌های پردازش‌شده در بازهٔ انتخابی"
      action={
        <div className="chart-legend" aria-label="راهنمای نمودار">
          <span><i className="legend-dot legend-dot--processed" />پردازش‌شده</span>
          <span><i className="legend-dot legend-dot--failed" />{failedTotal.toLocaleString('fa-IR')} ناموفق</span>
        </div>
      }
    >
      <div className="event-chart">
        <svg
          className="event-chart__plot"
          role="img"
          aria-labelledby="volume-chart-title volume-chart-description"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
        >
          <title id="volume-chart-title">نمودار جریان رویدادهای پردازش‌شده</title>
          <desc id="volume-chart-description">
            حجم رویدادها در طول بازهٔ انتخابی، همراه با تعداد خطاهای هر نقطه.
          </desc>
          {[chartTop, 73, 129, chartBottom].map((y) => (
            <line key={y} className="chart-gridline" x1={chartLeft} x2={chartRight} y1={y} y2={y} />
          ))}
          <path className="chart-area" d={areaPath} />
          <path className="chart-line" d={linePath} />
          {points.map((point) => (
            <g key={point.label}>
              <circle className="chart-point" cx={point.x} cy={point.y} r="4" />
              {point.failed > 0 ? (
                <circle className="chart-failure" cx={point.x} cy={chartTop + 2} r={Math.min(3 + point.failed / 18, 5)} />
              ) : null}
            </g>
          ))}
        </svg>
        <div className="chart-labels" aria-hidden="true">
          {points.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </div>
    </Panel>
  )
}
