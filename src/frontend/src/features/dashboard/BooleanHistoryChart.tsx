import type { DashboardBinaryParameter } from './dashboardApi'

const width = 760
const height = 188
const left = 12
const right = 748
const connectedY = 30
const disconnectedY = 142

const chartDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function BooleanHistoryChart({
  item,
}: {
  item: DashboardBinaryParameter
}) {
  const points = item.history
  const titleId = `boolean-chart-${item.parameter.id}-title`
  const descriptionId = `boolean-chart-${item.parameter.id}-description`

  if (!points.length) {
    return (
      <p className="binary-chart-empty" role="status">
        در این بازه داده‌ای برای نمودار نیست.
      </p>
    )
  }

  const plotted = points.map((point, index) => ({
    ...point,
    x:
      points.length === 1
        ? (left + right) / 2
        : left + ((right - left) * index) / (points.length - 1),
    y: point.value ? connectedY : disconnectedY,
  }))
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
  const stepPath = plotted
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`
      const previous = plotted[index - 1]
      return `L ${point.x} ${previous.y} L ${point.x} ${point.y}`
    })
    .join(' ')

  return (
    <div className="binary-chart-wrap">
      <div
        className="binary-chart-legend"
        role="group"
        aria-label="راهنمای نمودار اتصال"
      >
        <span><i className="binary-chart-legend__swatch binary-chart-legend__swatch--connected" />۱ = متصل</span>
        <span><i className="binary-chart-legend__swatch binary-chart-legend__swatch--disconnected" />۰ = قطع</span>
      </div>
      <div className="binary-chart">
        <div className="binary-chart__axis" aria-hidden="true">
          <span>۱ متصل</span>
          <span>۰ قطع</span>
        </div>
        <svg
          className="binary-chart__plot"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <title id={titleId}>تاریخچهٔ اتصال {item.parameter.title}</title>
          <desc id={descriptionId}>
            {points.length.toLocaleString('fa-IR')} نقطهٔ زمانی؛ مقدار ۱ متصل و مقدار ۰ قطع است.
          </desc>
          <rect
            className="binary-chart__band binary-chart__band--connected"
            x={left}
            y={connectedY - 18}
            width={right - left}
            height="36"
            rx="5"
          />
          <rect
            className="binary-chart__band binary-chart__band--disconnected"
            x={left}
            y={disconnectedY - 18}
            width={right - left}
            height="36"
            rx="5"
          />
          {[connectedY, disconnectedY].map((y) => (
            <line
              key={y}
              className="binary-chart__gridline"
              x1={left}
              x2={right}
              y1={y}
              y2={y}
            />
          ))}
          {plotted.slice(0, -1).map((point, index) => {
            const next = plotted[index + 1]
            return (
              <g key={`${point.observedAt}-${index}`}>
                <line
                  className={`binary-chart__segment binary-chart__segment--${point.value ? 'connected' : 'disconnected'}`}
                  x1={point.x}
                  x2={next.x}
                  y1={point.y}
                  y2={point.y}
                />
                {point.y !== next.y ? (
                  <line
                    className="binary-chart__transition"
                    x1={next.x}
                    x2={next.x}
                    y1={point.y}
                    y2={next.y}
                  />
                ) : null}
              </g>
            )
          })}
          <path className="binary-chart__step" d={stepPath} />
          {plotted.map((point, index) => (
            <circle
              key={`${point.observedAt}-point-${index}`}
              className={`binary-chart__point binary-chart__point--${point.value ? 'connected' : 'disconnected'}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
            />
          ))}
        </svg>
      </div>
      <div className="binary-chart__labels" aria-hidden="true">
        {labelIndexes.map((index) => (
          <span key={`${points[index].observedAt}-${index}`}>
            {formatChartDate(points[index].observedAt)}
          </span>
        ))}
      </div>
    </div>
  )
}

function formatChartDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return chartDateFormatter.format(date)
}
