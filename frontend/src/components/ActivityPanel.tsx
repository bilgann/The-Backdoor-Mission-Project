import React, { useEffect, useState, useCallback } from 'react'
import config from '../config'
import Chart from './Chart'
import CardFrame from './CardFrame'
import '../styles/ClientsTotalPanel.css'

const RANGES: Array<'day'|'week'|'month'|'year'> = ['day','week','month','year']

const ActivityPanel: React.FC = () => {
  const [range, setRange] = useState<'day'|'week'|'month'|'year'>('day')
  const [total, setTotal] = useState<number>(0)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async (r: typeof range) => {
    try {
      setLoading(true)

      // determine date range for API query (YYYY-MM-DD)
      const today = new Date()
      let startDate = new Date(today)
      let endDate = new Date(today)

      if (r === 'day') {
        // same day
        startDate = new Date(today)
        endDate = new Date(today)
      } else if (r === 'week') {
        const d = new Date(today)
        const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
        startDate = new Date(d)
        startDate.setDate(d.getDate() + diff)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
      } else if (r === 'month') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      } else if (r === 'year') {
        startDate = new Date(today.getFullYear(), 0, 1)
        endDate = new Date(today.getFullYear(), 11, 31)
      }

      const sd = startDate.toISOString().slice(0, 10)
      const ed = endDate.toISOString().slice(0, 10)

      const resp = await fetch(`${config.API_BASE}/client_activity?start_date=${sd}&end_date=${ed}`)
      const records = await resp.json()

      // total attendees = number of attendance records in the date range
      const totalCount = Array.isArray(records) ? records.length : 0
      setTotal(totalCount)

      // build chart data depending on range
      const chart: any[] = []

      if (r === 'day') {
        // hours 9..18
        const hours = Array.from({ length: 10 }, (_, i) => 9 + i)
        const counts = hours.map(() => 0)
        const now = new Date()
        const bucketHour = Math.min(Math.max(now.getHours(), 9), 18)

        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date) return
            const hasTime = String(rec.date).includes('T')
            const dt = new Date(rec.date)
            if (!hasTime) {
              // date-only: put into current bucket (bucketHour)
              const idx = hours.indexOf(bucketHour)
              if (idx >= 0) counts[idx]++
            } else {
              const h = dt.getHours()
              if (h >= 9 && h <= 18) {
                const idx = hours.indexOf(h)
                if (idx >= 0) counts[idx]++
              }
            }
          })
        }

        hours.forEach((h, i) => {
          let label = ''
          if (h < 12) label = `${h}am`
          else if (h === 12) label = '12pm'
          else label = `${h - 12}pm`
          chart.push({ label, value: counts[i] })
        })

      } else if (r === 'week') {
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        const counts = Array.from({ length: 7 }, () => 0)
        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date) return
            const dt = new Date(rec.date)
            // getDay: 0=Sun..6=Sat -> convert to Mon=0..Sun=6
            const dayIdx = dt.getDay() === 0 ? 6 : dt.getDay() - 1
            if (dayIdx >= 0 && dayIdx <= 6) counts[dayIdx]++
          })
        }
        days.forEach((d, i) => chart.push({ label: d, value: counts[i] }))

      } else if (r === 'month') {
        const start = startDate
        const daysInMonth = Math.floor((endDate.getTime() - start.getTime()) / (24*60*60*1000)) + 1
        const counts = Array.from({ length: daysInMonth }, () => 0)
        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date) return
            const dt = new Date(rec.date)
            const dayIdx = Math.floor((dt.getTime() - start.getTime()) / (24*60*60*1000))
            if (dayIdx >= 0 && dayIdx < daysInMonth) counts[dayIdx]++
          })
        }
        for (let i = 0; i < daysInMonth; i++) {
          chart.push({ label: String(i+1).padStart(2, '0'), value: counts[i] })
        }

      } else if (r === 'year') {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const counts = Array.from({ length: 12 }, () => 0)
        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date) return
            const dt = new Date(rec.date)
            const m = dt.getMonth()
            counts[m]++
          })
        }
        months.forEach((m, i) => chart.push({ label: m, value: counts[i] }))
      }

      setChartData(chart)

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
          <div className="ctp-title">Activity Attendees</div>
          <div className="ctp-number">{loading ? '—' : total}</div>

          <div className="ctp-date-block">
            <div className="ctp-date-label">Date</div>
            <div className="ctp-date-value">{todayStr}</div>
          </div>

          <div className="ctp-range-frame ctp-range-under">
            <div className="ctp-range-inner" style={{ ['--ctp-accent' as any]: '#FDA416' }}>
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
            <Chart data={chartData} height={220} lineColor="#FDA416" />
          </div>
        </div>
      </div>
    </CardFrame>
  )
}

export default ActivityPanel
