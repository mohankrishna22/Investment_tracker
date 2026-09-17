import { useState } from 'react'

export interface Slice {
  label: string
  value: number
  color: string
}

const TAU = Math.PI * 2

function arcPath(cx: number, cy: number, r: number, inner: number, from: number, to: number) {
  const large = to - from > Math.PI ? 1 : 0
  const p = (radius: number, angle: number) => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ]
  const [x1, y1] = p(r, from)
  const [x2, y2] = p(r, to)
  const [x3, y3] = p(inner, to)
  const [x4, y4] = p(inner, from)
  return `M${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${inner} ${inner} 0 ${large} 0 ${x4} ${y4}Z`
}

/**
 * Share-of-total donut. Identity comes from the legend beside it, never from
 * colour alone, and every slice carries its own value as a direct label.
 */
export function Donut({
  slices,
  centerLabel,
  centerValue,
  formatValue,
}: {
  slices: Slice[]
  centerLabel: string
  centerValue: string
  formatValue: (n: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = slices.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return <div className="muted">Nothing to chart yet.</div>

  const size = 190
  const cx = size / 2
  const cy = size / 2
  const r = 88
  const inner = 60
  // A 2px surface gap keeps adjacent fills from reading as one mark.
  const gap = 2 / r

  let angle = -Math.PI / 2
  const arcs = slices.map((s) => {
    const sweep = (s.value / total) * TAU
    const from = angle + (slices.length > 1 ? gap / 2 : 0)
    const to = angle + sweep - (slices.length > 1 ? gap / 2 : 0)
    angle += sweep
    return { slice: s, d: arcPath(cx, cy, r, inner, from, Math.max(from, to)) }
  })

  return (
    <div className="chart-flex">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
        {arcs.map((a, i) => (
          <path
            key={a.slice.label}
            d={a.d}
            fill={a.slice.color}
            opacity={hover === null || hover === i ? 1 : 0.35}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${a.slice.label}: ${formatValue(a.slice.value)}`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
          {centerLabel}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text)">
          {centerValue}
        </text>
      </svg>
      <div className="legend">
        {slices.map((s, i) => (
          <div
            key={s.label}
            className="legend-item"
            style={{ opacity: hover === null || hover === i ? 1 : 0.5 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="swatch" style={{ background: s.color }} />
            <span className="label">{s.label}</span>
            <span className="value">{formatValue(s.value)}</span>
            <span className="muted">{((s.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Bar with only its data end rounded; the baseline end stays square. */
function barPath(x: number, baseline: number, width: number, height: number) {
  const r = Math.min(4, width / 2, height)
  const top = baseline - height
  return `M${x} ${baseline}L${x} ${top + r}Q${x} ${top} ${x + r} ${top}L${x + width - r} ${top}Q${x + width} ${top} ${x + width} ${top + r}L${x + width} ${baseline}Z`
}

export interface BarPoint {
  label: string
  a: number
  b: number
}

/**
 * Two-series grouped bars on a single shared axis — money in and money out are
 * the same unit, so they never get a second scale.
 */
export function GroupedBars({
  points,
  seriesA,
  seriesB,
  colorA,
  colorB,
  formatValue,
}: {
  points: BarPoint[]
  seriesA: string
  seriesB: string
  colorA: string
  colorB: string
  formatValue: (n: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return <div className="muted">Nothing to chart yet.</div>

  const max = Math.max(...points.flatMap((p) => [p.a, p.b]), 1)
  const height = 180
  const barsTop = 12
  const plot = height - barsTop - 22
  const groupWidth = Math.max(34, Math.min(72, 640 / points.length))
  // Side padding so the first and last month labels are never clipped.
  const pad = 16
  const width = groupWidth * points.length + pad * 2
  const barWidth = Math.max(5, groupWidth / 2 - 5)
  const active = hover === null ? null : points[hover]

  return (
    <div>
      <div className="legend" style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
        <span className="legend-item" style={{ flex: 'none' }}>
          <span className="swatch" style={{ background: colorA }} /> {seriesA}
        </span>
        <span className="legend-item" style={{ flex: 'none' }}>
          <span className="swatch" style={{ background: colorB }} /> {seriesB}
        </span>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>
          {active
            ? `${active.label} · ${seriesA} ${formatValue(active.a)} · ${seriesB} ${formatValue(active.b)}`
            : 'Hover a month for exact figures'}
        </span>
      </div>
      <div className="table-wrap">
        <svg
          width={Math.max(width, 260)}
          height={height}
          viewBox={`0 0 ${Math.max(width, 260)} ${height}`}
          role="img"
          aria-label={`${seriesA} and ${seriesB} by month`}
        >
          <line
            x1="0"
            y1={barsTop + plot}
            x2={Math.max(width, 260)}
            y2={barsTop + plot}
            stroke="var(--border)"
            strokeWidth="1"
          />
          {points.map((p, i) => {
            const x = pad + i * groupWidth
            const ha = (p.a / max) * plot
            const hb = (p.b / max) * plot
            return (
              <g
                key={p.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                opacity={hover === null || hover === i ? 1 : 0.45}
              >
                <rect x={x} y={0} width={groupWidth} height={height} fill="transparent" />
                {p.a > 0 && (
                  <path
                    d={barPath(
                      x + groupWidth / 2 - barWidth - 1,
                      barsTop + plot,
                      barWidth,
                      Math.max(ha, 2),
                    )}
                    fill={colorA}
                  />
                )}
                {p.b > 0 && (
                  <path
                    d={barPath(x + groupWidth / 2 + 1, barsTop + plot, barWidth, Math.max(hb, 2))}
                    fill={colorB}
                  />
                )}
                <text
                  x={x + groupWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {p.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
