import React, { useEffect, useState, useCallback } from 'react'
import config from '../config'
import Chart from './Chart'
import CardFrame from './CardFrame'
import '../styles/ClientsTotalPanel.css'

const RANGES: Array<'day'|'week'|'month'|'year'> = ['day','week','month','year']

const ClinicPanel: React.FC = () => {
  const [range, setRange] = useState<'day'|'week'|'month'|'year'>('day')
  const [total, setTotal] = useState<number>(0)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async (r: typeof range) => {
    try {
      setLoading(true)
      const resp = await fetch(`${config.API_BASE}/api/clinic-statistics?range=${r}`)
      const json = await resp.json()
      if (json && json.success) {
        setTotal(json.total_clients ?? 0)
        let data = json.chart_data ?? []

        // Ensure day view shows hourly labels 9am-6pm on the x-axis. If the
        // backend doesn't provide per-hour buckets for clinic records (clinic
        // records currently store only a date), synthesize an hourly x-axis
        // with zeroed values so the chart renders the expected ticks.
        if (r === 'day') {
          const hours = Array.from({ length: 10 }, (_, i) => 9 + i) // 9..18
          // If backend returned per-day aggregate only, replace with hourly buckets
          const looksLikeDaily = !(Array.isArray(data) && data.length > 1 && String(data[0].label).toLowerCase().includes('am'))
          if (looksLikeDaily) {
            data = hours.map((h) => {
              const label = h === 12 ? '12pm' : (h < 12 ? `${h}am` : `${h - 12}pm`)
              return { label, value: 0 }
            })
          }
        }

        setChartData(data)
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
          <div className="ctp-title">Clinic Records</div>
          <div className="ctp-number">{loading ? '—' : total}</div>

          <div className="ctp-date-block">
            <div className="ctp-date-label">Date</div>
            <div className="ctp-date-value">{todayStr}</div>
          </div>

          <div className="ctp-range-frame ctp-range-under">
            <div className="ctp-range-inner" style={{ ['--ctp-accent' as any]: '#F24B8E' }}>
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
            <Chart data={chartData} height={220} lineColor="#F24B8E" />
          </div>
        </div>
      </div>
    </CardFrame>
  )
}

export default ClinicPanel
