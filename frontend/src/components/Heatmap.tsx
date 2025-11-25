import React from 'react'
import '../styles/Heatmap.css'

type HeatmapData = {
  [day: string]: { [hour: string]: number }
}

interface HeatmapProps {
  data: HeatmapData
  days?: string[]
  hours?: number[]
  colorScale?: string[]
  labelColor?: string
}

const defaultDays = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const defaultHours = Array.from({length: 10}, (_,i)=>9 + i) // 9..18
const defaultColors = ['#FF9294','#FF5151','#F50C0C','#C10830','#C10830']

const getColorForBucket = (idx: number, scale: string[]) => {
  return scale[Math.max(0, Math.min(scale.length - 1, idx))]
}

const Heatmap: React.FC<HeatmapProps> = ({ data, days = defaultDays, hours = defaultHours, colorScale = defaultColors, labelColor = '#FFFFFF' }) => {
  // Flatten values and compute buckets
  const values: number[] = []
  days.forEach((d) => {
    hours.forEach((h) => {
      const v = data?.[d]?.[String(h)] ?? 0
      values.push(typeof v === 'number' ? v : 0)
    })
  })

  const maxVal = Math.max(...values, 0)
  // Ensure there is at least 1 so we don't divide by zero
  const step = maxVal > 0 ? Math.ceil(maxVal / colorScale.length) : 1

  const bucketForValue = (v: number) => {
    if (v <= 0) return 0
    // Use floor(v / step) so that ranges like 0-(step-1), step-(2*step-1) align correctly
    const idx = Math.min(colorScale.length - 1, Math.floor(v / step))
    return idx
  }

  const ranges = colorScale.map((_, i) => {
    const start = i * step
    const end = (i + 1) * step - 1
    if (i === 0) return `0 - ${end}`
    if (i === colorScale.length - 1) return `${start}+`
    return `${start} - ${end}`
  })

  return (
    <div className="heatmap-root">
      <div className="heatmap-grid-wrap">
        <div className="heatmap-left">
          <div className="heatmap-ylabels">
            {days.map((d) => (
              <div key={d} className="heatmap-ylabel">{d}</div>
            ))}
          </div>
        </div>

        <div className="heatmap-grid">
          {/* column headers (hours) */}
          <div className="heatmap-grid-header">
            {hours.map((h) => (
              <div key={h} className="heatmap-xlabel">{h <= 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`}</div>
            ))}
          </div>

          <div className="heatmap-grid-body">
            {days.map((d) => (
              <div key={d} className="heatmap-row">
                {hours.map((h) => {
                  const val = Number(data?.[d]?.[String(h)] ?? 0)
                  const bucket = bucketForValue(val)
                  const color = getColorForBucket(bucket, colorScale)
                  return (
                    <div
                      key={`${d}-${h}`}
                      className="heatmap-cell"
                      style={{ backgroundColor: color }}
                      title={`${d} ${h}:00 — ${val} (bucket ${bucket}) max=${maxVal} step=${step}`}
                      data-bucket={bucket}
                    >
                      <span className="heatmap-cell-label" style={{ color: labelColor }}>{val}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* legend moved to the left column under day labels */}
        </div>
      </div>

      {/* legend is separate from the left column, placed under the heatmap area but visually aligned */}
      <div className="heatmap-legend-container">
        {colorScale.map((c, i) => (
          <div key={c} className="heatmap-legend-item">
            <div className="legend-heatbox" style={{ backgroundColor: c }} />
            <div className="legend-label">{ranges[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Heatmap
