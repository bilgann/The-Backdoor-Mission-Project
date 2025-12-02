import React, { useEffect, useState } from 'react'
import config from '../config'
import CardFrame from './CardFrame'
import '../styles/AttendanceRecords.css'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

type ActivityItem = {
  activity_id: number
  activity_name: string
  date: string
  start_time?: string | null
  end_time?: string | null
  attendance?: number
}

type ClientActivity = {
  client_activity_id: number
  client_id: number
  client_name?: string
  activity_id: number
  activity_name?: string
  date: string
  score?: number | null
}

const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const dayColors = ['#27608F','#FC8C37','#F6254F','#C3E4FF','#C3FFD7']

function parseISODateToLocal(dstr: string){
  if(!dstr) return new Date(dstr)
  try{
    // date-only (YYYY-MM-DD)
    if(/^\d{4}-\d{2}-\d{2}$/.test(dstr)){
      const parts = dstr.split('-').map(p=>Number(p))
      return new Date(parts[0], parts[1]-1, parts[2])
    }
    // datetime (YYYY-MM-DDTHH:MM:SS(.sss)?(±TZ)?) -> parse components and construct local Date
    const m = dstr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/)
    if(m){
      const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3])
      const hh = Number(m[4]), mm = Number(m[5]), ss = Number(m[6])
      return new Date(y, mo-1, da, hh, mm, ss)
    }
  }catch(e){/* fallback */}
  return new Date(dstr)
}

function formatDateLocal(d: Date){
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}

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
  refreshToken?: number
}

const AttendanceRecords: React.FC<Props> = ({ weekStart, refreshToken }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [clientActs, setClientActs] = useState<ClientActivity[]>([])

  useEffect(() => {
    const ws = weekStart || startOfWeek(new Date())
    fetchForWeek(ws)
  }, [weekStart, refreshToken])

  async function fetchForWeek(ws: Date){
    setLoading(true)
    const start = formatDateLocal(ws)
    const end = formatDateLocal(new Date(ws.getTime() + 6*24*60*60*1000))
    try{
      const [aRes, caRes] = await Promise.all([
        fetch(`${config.API_BASE}/activity?start_date=${start}&end_date=${end}`),
        fetch(`${config.API_BASE}/client_activity?start_date=${start}&end_date=${end}`)
      ])
      if(aRes.ok){
        const data = await aRes.json()
        setActivities(data)
      } else {
        console.error('[AttendanceRecords] activity fetch failed', aRes.status)
      }
      if(caRes.ok){
        const ca = await caRes.json()
        setClientActs(ca)
      } else {
        console.error('[AttendanceRecords] client_activity fetch failed', caRes.status)
      }
    }catch(e){/* ignore */}
    setLoading(false)
  }

  // group activities by weekday index 0..4 (Mon..Fri)
  const groups: ActivityItem[][] = [[],[],[],[],[]]
  for(const a of activities){
    const ad = parseISODateToLocal(a.date)
    const dayIdx = (ad.getDay() === 0 ? 6 : ad.getDay()-1)
    if(dayIdx >=0 && dayIdx <=4){
      groups[dayIdx].push(a)
    }
  }

  // compute attendance totals per day based on clientActs
  const totals = groups.map((g) => {
    const activityIds = g.map(x => x.activity_id)
    const cnt = clientActs.filter(ca => activityIds.includes(ca.activity_id)).length
    return cnt
  })
  const pieData = totals.map((t,idx)=>({ name: dayNames[idx], value: t }))

  function participantsForActivity(activity_id: number){
    return clientActs.filter(ca => ca.activity_id === activity_id)
  }

  return (
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

      <CardFrame className="attendance-card">
        <div className="attendance-right">
          <div className="records-table-wrapper">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Client</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, dayIdx) => (
                  <React.Fragment key={dayIdx}>
                    <tr className="day-row">
                      <td colSpan={3} className="day-header"><span className="day-name">{dayNames[dayIdx]}</span><span className="day-color" style={{background: dayColors[dayIdx]}}></span></td>
                    </tr>
                    {g.length === 0 ? (
                      <tr className="empty-row" key={`empty-${dayIdx}`}>
                        <td colSpan={3} style={{padding:'8px 12px', color:'#777'}}>No activities</td>
                      </tr>
                    ) : g.sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime()).map(it => {
                      const parts = participantsForActivity(it.activity_id)
                      return (
                        <React.Fragment key={it.activity_id}>
                          <tr className="activity-row" key={`act-${it.activity_id}`}>
                            <td className="name-cell" colSpan={3}><span className="name-color" style={{background: dayColors[dayIdx]}}></span>{it.activity_name}</td>
                          </tr>
                          {parts.length === 0 ? (
                            <tr key={`pempty-${it.activity_id}`}><td colSpan={3} style={{padding:'6px 12px', color:'#777'}}>No attendees</td></tr>
                          ) : parts.map(p => (
                            <tr key={`p-${p.client_activity_id}`}>
                              <td style={{paddingLeft:20}}>{p.activity_name}</td>
                              <td>{p.client_name ?? `Client #${p.client_id}`}</td>
                              <td>{p.score ?? '-'}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardFrame>
    </div>
  )
}

export default AttendanceRecords
