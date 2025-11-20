import React, { useEffect, useState } from 'react'
import config from '../config'
import CreateEventModal from './CreateEventModal'
import '../styles/Activity.css'

type ActivityItem = {
  activity_id: number
  client_id: number
  activity_name: string
  date: string
  start_time?: string | null
  end_time?: string | null
  attendance?: number
}

const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday']

function startOfWeek(d: Date){
  const date = new Date(d)
  const day = date.getDay()
  // JS: 0 = Sunday, want Monday as start
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0,0,0,0)
  return date
}

interface ActivityCalendarProps {
  onWeekChange?: (d: Date) => void
}

const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ onWeekChange }) => {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()))
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [rowHeightPx, setRowHeightPx] = useState<number>(54)
  const [rowGapPx, setRowGapPx] = useState<number>(0)

  useEffect(() => { fetchActivities() }, [weekStart])

  useEffect(() => {
    if(onWeekChange) onWeekChange(weekStart)
  }, [weekStart, onWeekChange])

  useEffect(() => {
    function measure() {
      try{
        const el = panelRef.current
        if(!el) return
        const cs = getComputedStyle(el)
        const rh = parseFloat(cs.getPropertyValue('--row-height')) || 54
        const rg = parseFloat(cs.getPropertyValue('--row-gap')) || 0
        setRowHeightPx(rh)
        setRowGapPx(rg)
      }catch(e){/* ignore */}
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  async function fetchActivities(){
    const start = weekStart.toISOString().slice(0,10)
    const end = new Date(weekStart.getTime() + 6*24*60*60*1000).toISOString().slice(0,10)
    const res = await fetch(`${config.API_BASE}/activity?start_date=${start}&end_date=${end}`)
    if(res.ok){
      const data = await res.json()
      // merge local colors stored in localStorage
      try{
        const map = JSON.parse(localStorage.getItem('activityColors') || '{}')
        for(const it of data){
          if(!it.color && it.activity_id && map[it.activity_id]){
            it.color = map[it.activity_id]
          }
        }
      }catch(e){/* ignore */}
      setActivities(data)
    }
  }

  function prevWeek(){
    setWeekStart(new Date(weekStart.getTime() - 7*24*60*60*1000))
  }
  function nextWeek(){
    setWeekStart(new Date(weekStart.getTime() + 7*24*60*60*1000))
  }
  function goToday(){
    setWeekStart(startOfWeek(new Date()))
  }

  // include 6pm (18) so hours 8am..6pm -> 11 rows
  const hours = Array.from({length:11}).map((_,i)=>8+i)

  function renderEvent(ev: ActivityItem){
    const evDate = new Date(ev.date)
    const dayIdx = (evDate.getDay() === 0 ? 6 : evDate.getDay()-1) // Monday=0
    if(dayIdx < 0 || dayIdx > 4) return null

    // compute continuous start/end in minutes for accurate placement
    const start = ev.start_time ? new Date(ev.start_time) : null
    const end = ev.end_time ? new Date(ev.end_time) : null
    const defaultStart = 13
    const sHour = start ? start.getHours() : defaultStart
    const sMin = start ? start.getMinutes() : 0
    const eHour = end ? end.getHours() : (sHour + 1)
    const eMin = end ? end.getMinutes() : 0

    const startTotalHours = (sHour + sMin/60)
    const endTotalHours = (eHour + eMin/60)
    // visible range is 8..18 (hours)
    const visibleStart = 8
    const visibleEnd = 18
    if(endTotalHours <= visibleStart || startTotalHours >= visibleEnd) return null

    const clampedStart = Math.max(startTotalHours, visibleStart)
    const clampedEnd = Math.min(endTotalHours, visibleEnd)
    const durationHours = Math.max(0.25, clampedEnd - clampedStart)

    const totalSlotHeight = rowHeightPx + rowGapPx
    const top = (clampedStart - visibleStart) * totalSlotHeight
    const height = durationHours * totalSlotHeight - rowGapPx

    // map backgrounds to harmonious darker text colors
    const textForBg: Record<string,string> = {
      '#C3E4FF': '#0B3A66',
      '#C3FFD7': '#0B6B3B',
      '#FC8C37': '#7A4300',
      '#F6254F': '#7A071F',
      '#27608F': '#07293F',
      '#FFED7A': '#7A5D00'
    }
    const bg = (ev as any).color || '#cfe9ff'
    const textColor = textForBg[bg] || '#000'

    const style: React.CSSProperties = {
      top: `${top}px`,
      height: `${height}px`,
      position: 'absolute',
      left: '4px',
      right: '4px',
      background: bg,
      borderRadius: 10,
      color: textColor,
      paddingTop: 8,
      paddingLeft: 10
    }

    return (
      <div key={ev.activity_id} className={`ac-event ac-event-${dayIdx}`} style={style} title={ev.activity_name}>
        <div className="ac-event-name">{ev.activity_name}</div>
        <div className="ac-event-time">{start ? `${start.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})} - ${end ? end.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : ''}` : ''}</div>
      </div>
    )
  }

  const days = Array.from({length:5}).map((_,i)=>{
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div className="activity-panel" ref={panelRef}>
      <div className="activity-header">
        <div className="activity-left">
          <div className="today-label">{new Date().toLocaleDateString(undefined, {month:'long', day:'numeric', year:'numeric'})}</div>
          <button className="today-button" onClick={goToday}>Today</button>
        </div>
        <div className="activity-right">
          <button className="new-button" onClick={()=>setShowModal(true)}><span className="plus">+</span>New</button>
        </div>
      </div>

      <div className="week-nav">
        <button className="nav-btn" onClick={prevWeek} aria-label="Previous week"> 
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15.8333 10.0001H4.16663M4.16663 10.0001L9.99996 15.8334M4.16663 10.0001L9.99996 4.16675" stroke="#5B5B5B" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="days-row">
          {days.map((d,idx)=> (
            <div key={idx} className="day-header">
              <div className="day-name">{dayNames[idx]}</div>
              <div className="day-date">{d.getDate()}</div>
            </div>
          ))}
        </div>
        <button className="nav-btn" onClick={nextWeek} aria-label="Next week">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4.16671 10.0001H15.8334M15.8334 10.0001L10 15.8334M15.8334 10.0001L10 4.16675" stroke="#5B5B5B" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="calendar-grid">
        <div className="time-col">
          {hours.map(h=> (
            <div key={h} className="time-cell"><div className="hour-inner">{h < 12 ? `${h} AM` : (h===12? '12 PM' : `${h-12} PM`)}</div></div>
          ))}
        </div>
        <div className="days-col">
          {days.map((d,dayIdx)=> (
            <div key={dayIdx} className="day-column">
              <div className="day-grid" style={{gridTemplateRows: `repeat(${hours.length}, 1fr)`}}>
                {hours.map(h=> (
                  <div key={h} className="slot-cell" data-hour={h}></div>
                ))}
                {activities.filter(a => {
                  const ad = new Date(a.date)
                  return ad.getFullYear()===d.getFullYear() && ad.getMonth()===d.getMonth() && ad.getDate()===d.getDate()
                }).map(ev => renderEvent(ev))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && <CreateEventModal onClose={()=>{setShowModal(false); fetchActivities()}} />}
    </div>
  )
}

export default ActivityCalendar
