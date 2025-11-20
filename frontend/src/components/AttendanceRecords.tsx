import React, { useEffect, useState } from 'react'
import config from '../config'
import CardFrame from './CardFrame'
import '../styles/AttendanceRecords.css'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

type ActivityItem = {
  activity_id: number
  client_id?: number
  activity_name: string
  date: string
  start_time?: string | null
  end_time?: string | null
  attendance?: number
  color?: string
}

const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const dayColors = ['#27608F','#FC8C37','#F6254F','#C3E4FF','#C3FFD7']

function startOfWeek(d: Date){
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0,0,0,0)
  return date
}

interface Props {
  weekStart?: Date | null
}

const AttendanceRecords: React.FC<Props> = ({ weekStart }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ws = weekStart || startOfWeek(new Date())
    fetchForWeek(ws)
  }, [weekStart])

  async function fetchForWeek(ws: Date){
    setLoading(true)
    const start = ws.toISOString().slice(0,10)
    const end = new Date(ws.getTime() + 6*24*60*60*1000).toISOString().slice(0,10)
    try{
      const res = await fetch(`${config.API_BASE}/activity?start_date=${start}&end_date=${end}`)
      if(res.ok){
        const data = await res.json()
        setActivities(data)
      }
    }catch(e){/* ignore */}
    setLoading(false)
  }

  // group activities by weekday index 0..4 (Mon..Fri)
  const groups: ActivityItem[][] = [[],[],[],[],[]]
  const ws = weekStart || startOfWeek(new Date())
  for(const a of activities){
    const ad = new Date(a.date)
    const dayIdx = (ad.getDay() === 0 ? 6 : ad.getDay()-1)
    if(dayIdx >=0 && dayIdx <=4){
      groups[dayIdx].push(a)
    }
  }

  // compute attendance totals per day (use provided attendance when > 0, otherwise count event as 1)
  const totals = groups.map(g => g.reduce((s, it) => {
    const val = (typeof it.attendance === 'number' && it.attendance > 0) ? it.attendance : 1
    return s + val
  }, 0))
  let grandTotal = totals.reduce((s,t)=>s+t, 0)
  if(grandTotal <= 0) grandTotal = 1
  const pieData = totals.map((t,idx)=>({ name: dayNames[idx], value: t }))

  return (
    <CardFrame className="attendance-card">
      <div className="attendance-inner">
        <div className="attendance-left">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} startAngle={90} endAngle={-270} paddingAngle={2}>
                {pieData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={dayColors[idx % dayColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value:any, name:any) => [`${value}`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="attendance-right">
          <div className="records-table-wrapper">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Attendance</th>
                  <th>Percentage</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, dayIdx) => (
                  <React.Fragment key={dayIdx}>
                    <tr className="day-row">
                      <td colSpan={4} className="day-header"><span className="day-color" style={{background: dayColors[dayIdx]}}></span>{dayNames[dayIdx]}</td>
                    </tr>
                    {g.length === 0 ? (
                      <tr className="empty-row" key={`empty-${dayIdx}`}>
                        <td colSpan={4} style={{padding:'8px 12px', color:'#777'}}>No activities</td>
                      </tr>
                    ) : g.sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime()).map(it => {
                      const ad = new Date(it.date)
                      // match totals logic: treat missing or zero attendance as 1 for pie/table percentage
                      const att = (typeof it.attendance === 'number' && it.attendance > 0) ? it.attendance : 1
                      const pct = ((att / grandTotal) * 100)
                      const pctText = `${pct.toFixed(1)}%`
                      const dateText = ad.toLocaleDateString(undefined, {month:'short', day:'numeric'})
                      return (
                        <tr key={it.activity_id}>
                          <td className="name-cell"><span className="name-color" style={{background: dayColors[dayIdx]}}></span>{it.activity_name}</td>
                          <td>{att}</td>
                          <td>{pctText}</td>
                          <td>{dateText}</td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CardFrame>
  )
}

export default AttendanceRecords
