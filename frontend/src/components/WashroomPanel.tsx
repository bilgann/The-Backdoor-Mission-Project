import React, { useEffect, useState, useCallback } from 'react'
import config from '../config'
import Chart from './Chart'
import CardFrame from './CardFrame'
import '../styles/ClientsTotalPanel.css'

const RANGES: Array<'day'|'week'|'month'|'year'> = ['day','week','month','year']

const WashroomPanel: React.FC = () => {
  const [range, setRange] = useState<'day'|'week'|'month'|'year'>('day')
  const [total, setTotal] = useState<number>(0)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async (r: typeof range) => {
    try {
      setLoading(true)
      const resp = await fetch(`${config.API_BASE}/api/washroom-statistics?range=${r}`)
      const json = await resp.json()
      if (json && json.success) {
        setTotal(json.total_clients ?? 0)
        setChartData(json.chart_data ?? [])
      } else if (json && typeof json.total_clients !== 'undefined') {
        setTotal(json.total_clients)
        setChartData(json.chart_data ?? [])
      } else {
        setTotal(0)
        setChartData([])
      }
    } catch (e) {
      setTotal(0)
      setChartData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats(range)
  }, [range, fetchStats])

  useEffect(() => {
    const onData = () => fetchStats(range)
    window.addEventListener('dataUpdated', onData)
    return () => window.removeEventListener('dataUpdated', onData)
  }, [range, fetchStats])

  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <CardFrame className="clients-card">
      <div className="clients-total-panel">
        <div className="ctp-header">
          <div className="ctp-title">Washroom Records</div>
          <div className="ctp-number">{loading ? '—' : total}</div>

          <div className="ctp-date-block">
            <div className="ctp-date-label">Date</div>
            <div className="ctp-date-value">{todayStr}</div>
          </div>

          <div className="ctp-range-frame ctp-range-under">
            <div className="ctp-range-inner">
              {RANGES.map((r) => (
                <button
                  key={r}
                  className={`ctp-range-btn ${range === r ? 'active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ctp-body">
          <div className="ctp-chart">
            <Chart data={chartData} height={220} lineColor="#6ECAEE" />
          </div>
        </div>
      </div>
    </CardFrame>
  )
}

export default WashroomPanel
