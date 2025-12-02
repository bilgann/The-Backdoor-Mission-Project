import React, { useCallback, useEffect, useState } from 'react'
import config from '../config'
import Chart from './Chart'
import CardFrame from './CardFrame'
import '../styles/ClientsTotalPanel.css'

function parseISODateToLocal(dstr: string){
  if(!dstr) return new Date(dstr)
  try{
    if(/^\d{4}-\d{2}-\d{2}$/.test(dstr)){
      const parts = dstr.split('-').map(p=>Number(p))
      return new Date(parts[0], parts[1]-1, parts[2])
    }
    const m = dstr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/)
    if(m){
      const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3])
      const hh = Number(m[4]), mm = Number(m[5]), ss = Number(m[6])
      return new Date(y, mo-1, da, hh, mm, ss)
    }
  }catch(e){/* fallback */}
  return new Date(dstr)
}

const ScorePanel: React.FC = () => {
  const [range, setRange] = useState<'day'|'week'|'month'|'year'>('day')
  const [avg, setAvg] = useState<number | null>(null)
  const [responses, setResponses] = useState<number>(0)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async (r: typeof range) => {
    try {
      setLoading(true)

      const today = new Date()
      let startDate = new Date(today)
      let endDate = new Date(today)

      if (r === 'day') {
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

      function formatDateLocal(d: Date){
        const y = d.getFullYear()
        const m = String(d.getMonth()+1).padStart(2,'0')
        const dd = String(d.getDate()).padStart(2,'0')
        return `${y}-${m}-${dd}`
      }

      const resp = await fetch(`${config.API_BASE}/client_activity?start_date=${formatDateLocal(startDate)}&end_date=${formatDateLocal(endDate)}`)
      const records = await resp.json()

      // compute overall average score and response count
      let totalScore = 0
      let count = 0

      if (Array.isArray(records)) {
        records.forEach((rec: any) => {
          if (rec && rec.score !== undefined && rec.score !== null) {
            const s = Number(rec.score)
            if (!isNaN(s)) {
              totalScore += s
              count++
            }
          }
        })
      }

      setResponses(count)
      setAvg(count > 0 ? totalScore / count : null)

      // build chart data: average score per bucket similar to ActivityPanel
      const chart: any[] = []

      if (r === 'day') {
        const hours = Array.from({ length: 10 }, (_, i) => 9 + i)
        const sums = hours.map(() => 0)
        const counts = hours.map(() => 0)

        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date || rec.score === undefined || rec.score === null) return
            const raw = rec.date
            const dt = parseISODateToLocal(raw)
            const h = dt.getHours()
            if (h >= 9 && h <= 18) {
              const idx = hours.indexOf(h)
              if (idx >= 0) {
                sums[idx] += Number(rec.score)
                counts[idx]++
              }
            }
          })
        }

        hours.forEach((h, i) => {
          let label = ''
          if (h < 12) label = `${h}am`
          else if (h === 12) label = '12pm'
          else label = `${h - 12}pm`
          const value = counts[i] > 0 ? +(sums[i] / counts[i]) : 0
          chart.push({ label, value })
        })

      } else if (r === 'week') {
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        const sums = Array.from({ length: 7 }, () => 0)
        const counts = Array.from({ length: 7 }, () => 0)
        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date || rec.score === undefined || rec.score === null) return
            const dt = parseISODateToLocal(rec.date)
            const dayIdx = dt.getDay() === 0 ? 6 : dt.getDay() - 1
            if (dayIdx >= 0 && dayIdx <= 6) {
              sums[dayIdx] += Number(rec.score)
              counts[dayIdx]++
            }
          })
        }
        days.forEach((d, i) => chart.push({ label: d, value: counts[i] > 0 ? +(sums[i]/counts[i]) : 0 }))

      } else if (r === 'month') {
        const start = startDate
        const daysInMonth = Math.floor((endDate.getTime() - start.getTime()) / (24*60*60*1000)) + 1
        const sums = Array.from({ length: daysInMonth }, () => 0)
        const counts = Array.from({ length: daysInMonth }, () => 0)
        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date || rec.score === undefined || rec.score === null) return
            const dt = parseISODateToLocal(rec.date)
            const dayIdx = Math.floor((dt.getTime() - start.getTime()) / (24*60*60*1000))
            if (dayIdx >= 0 && dayIdx < daysInMonth) {
              sums[dayIdx] += Number(rec.score)
              counts[dayIdx]++
            }
          })
        }
        for (let i = 0; i < daysInMonth; i++) chart.push({ label: String(i+1).padStart(2, '0'), value: counts[i] > 0 ? +(sums[i]/counts[i]) : 0 })

      } else if (r === 'year') {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const sums = Array.from({ length: 12 }, () => 0)
        const counts = Array.from({ length: 12 }, () => 0)
        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            if (!rec.date || rec.score === undefined || rec.score === null) return
            const dt = parseISODateToLocal(rec.date)
            const m = dt.getMonth()
            sums[m] += Number(rec.score)
            counts[m]++
          })
        }
        months.forEach((m, i) => chart.push({ label: m, value: counts[i] > 0 ? +(sums[i]/counts[i]) : 0 }))
      }

      setChartData(chart)

    } catch (e) {
      setAvg(null)
      setResponses(0)
      setChartData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats(range) }, [range, fetchStats])

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
          <div className="ctp-title">Activity Scores</div>
          <div className="ctp-number">{loading ? '—' : (avg !== null ? avg.toFixed(1) : '-')}</div>

          <div className="ctp-date-block">
            <div className="ctp-date-label">Date</div>
            <div className="ctp-date-value">{todayStr}</div>
          </div>

          <div className="ctp-range-frame ctp-range-under">
            <div className="ctp-range-inner" style={{ ['--ctp-accent' as any]: '#765FF9' }}>
              {(['day','week','month','year'] as const).map((r) => (
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
            <Chart data={chartData} height={220} lineColor="#765FF9" />
          </div>
        </div>
      </div>
    </CardFrame>
  )
}

export default ScorePanel
