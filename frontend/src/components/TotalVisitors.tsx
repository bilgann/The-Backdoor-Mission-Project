import React, { useState, useEffect, useCallback, useRef } from 'react'
import CardFrame from './CardFrame'
import '../styles/TotalVisitors.css'
import TimeRangeSlider from './TimeRangeSlider'
import config from '../config'

const SERVICE_COLORS: { [key: string]: string } = {
  'Coat Check': '#FE2323',
  'Washroom': '#6ECAEE',
  'Sanctuary': '#D9F373',
  'Clinic': '#FA488F',
  'Safe Sleep': '#2C3B9C'
}

interface DeptData {
  name: string
  value: number // absolute visitors
  pctOfTotal?: number
  pctOfMax?: number
}

interface ApiResult {
  success: boolean
  total_clients?: number
  service_breakdown?: { [key: string]: number }
}

const TotalVisitors: React.FC<{ showRangeSelector?: boolean }> = ({ showRangeSelector = false }) => {
  const [data, setData] = useState<DeptData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const frameRef = useRef<HTMLDivElement | null>(null)

  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipContent, setTooltipContent] = useState('')
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 })

  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await fetch(`${config.API_BASE}/api/client-statistics?range=${range}`)
      const result: ApiResult = await resp.json()
      if (result.success && result.service_breakdown) {
        const breakdown = result.service_breakdown
        const entries: DeptData[] = Object.keys(SERVICE_COLORS).map(name => ({
          name,
          value: breakdown[name] || 0
        }))
        const tot = entries.reduce((s, e) => s + e.value, 0)
        const maxVal = entries.length ? Math.max(...entries.map(e => e.value)) : 0
        const withPct = entries.map(e => ({
          ...e,
          pctOfTotal: tot > 0 ? (e.value / tot) * 100 : 0,
          pctOfMax: maxVal > 0 ? (e.value / maxVal) * 100 : 0
        }))
        setData(withPct)
        setTotal(tot)
      } else {
        setError('Failed to load visitor statistics')
      }
    } catch (err) {
      console.error(err)
      setError('Error connecting to server')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchStatistics()
    const interval = setInterval(fetchStatistics, 30000)
    return () => clearInterval(interval)
  }, [fetchStatistics])

  // Refresh immediately when other parts of the app signal data changes
  useEffect(() => {
    const onData = () => fetchStatistics()
    window.addEventListener('dataUpdated', onData)
    return () => window.removeEventListener('dataUpdated', onData)
  }, [fetchStatistics])

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (loading && data.length === 0) {
    return (
      <CardFrame className="total-visitors-frame">
        <div className="loading-message">Loading visitors...</div>
      </CardFrame>
    )
  }

  if (error && data.length === 0) {
    return (
      <CardFrame className="total-visitors-frame">
        <div className="error-message">{error}</div>
      </CardFrame>
    )
  }

  const showTooltip = (dept: DeptData, e: React.MouseEvent) => {
    if (!frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const left = e.clientX - rect.left
    const top = e.clientY - rect.top
    const label = dept.value === 1 ? 'record' : 'records'
    setTooltipContent(`${dept.value} ${label}`)
    setTooltipPos({ left, top })
    setTooltipVisible(true)
  }

  const moveTooltip = (e: React.MouseEvent) => {
    if (!frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    setTooltipPos({ left: e.clientX - rect.left, top: e.clientY - rect.top })
  }

  const hideTooltip = () => setTooltipVisible(false)

  return (
    <CardFrame className="total-visitors-frame">
      <div ref={frameRef} className="total-visitors-inner">
        <div className="header-number-group">
          <div className="total-visitors-header">
            <h3 className="total-visitors-title">Total Visitors</h3>
            <span className="total-visitors-date">{today}</span>
          </div>

          <div className="total-visitors-number-container">
            <div className="total-visitors-number">{total}</div>
          </div>
        </div>

        {/* Time range selector placed directly under the total number (sibling to header-number-group) */}
        <TimeRangeSlider selectedRange={range} onRangeChange={(r) => setRange(r)} />

        <div className="departments-row">
          {data.map(dept => (
            <div key={dept.name} className="dept-column">
              <div className="dept-name">{dept.name}</div>
              <div className="dept-pct">{Math.round(dept.pctOfTotal || 0)}%</div>

              <div className="dept-bar-outer">
                <div
                  className="dept-bar-inner"
                  onMouseEnter={(e) => showTooltip(dept, e)}
                  onMouseMove={(e) => moveTooltip(e)}
                  onMouseLeave={() => hideTooltip()}
                  style={{
                    height: `${dept.pctOfMax || 0}%`,
                    backgroundColor: SERVICE_COLORS[dept.name] || '#999'
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {tooltipVisible && (
          <div
            className="tv-tooltip"
            style={{ left: tooltipPos.left, top: tooltipPos.top }}
            aria-hidden={!tooltipVisible}
          >
            {tooltipContent}
          </div>
        )}
      </div>
    </CardFrame>
  )
}

export default TotalVisitors
