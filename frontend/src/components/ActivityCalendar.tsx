import React, { useEffect, useState, useMemo } from 'react'
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
  onEventCreated?: () => void
}

const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ onWeekChange, onEventCreated }) => {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()))
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [calendarEditMode, setCalendarEditMode] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ActivityItem | null>(null)
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

  // keep weekStart in sync with the real current week.
  // This checks hourly and updates weekStart when the Monday boundary passes.
  useEffect(() => {
    const id = setInterval(() => {
      const nowStart = startOfWeek(new Date())
      setWeekStart(prev => {
        if(!prev) return nowStart
        if(prev.getTime() !== nowStart.getTime()) return nowStart
        return prev
      })
    }, 60 * 60 * 1000) // every hour

    // run once immediately on mount to ensure freshness
    const nowStart = startOfWeek(new Date())
    setWeekStart(prev => {
      if(!prev) return nowStart
      if(prev.getTime() !== nowStart.getTime()) return nowStart
      return prev
    })

    return () => clearInterval(id)
  }, [])

  // compute column layout per-day so overlapping events are shown side-by-side
  const layoutMap = useMemo(() => {
    const map: Record<number, { col: number, total: number }> = {}
    // group activities by date (day index relative to weekStart)
    const days: ActivityItem[][] = [[],[],[],[],[]]
    for(const a of activities){
      const ad = parseISODateToLocal(a.date)
      const dayIdx = (ad.getDay() === 0 ? 6 : ad.getDay()-1)
      if(dayIdx >=0 && dayIdx <=4) days[dayIdx].push(a)
    }

    for(let dayIdx=0; dayIdx<5; dayIdx++){
      const evs = days[dayIdx].map(ev => {
        const start = ev.start_time ? new Date(ev.start_time) : null
        const end = ev.end_time ? new Date(ev.end_time) : null
        const defaultStart = 13
        const sHour = start ? start.getHours() : defaultStart
        const sMin = start ? start.getMinutes() : 0
        const eHour = end ? end.getHours() : (sHour + 1)
        const eMin = end ? end.getMinutes() : 0
        const startTotal = sHour + sMin/60
        const endTotal = eHour + eMin/60
        return { ev, startTotal, endTotal }
      }).sort((a,b) => a.startTotal - b.startTotal)

      const columnsEnd: number[] = []
      for(const item of evs){
        let placed = false
        for(let ci = 0; ci < columnsEnd.length; ci++){
          if(columnsEnd[ci] <= item.startTotal){
            // place here
            map[item.ev.activity_id] = { col: ci, total: 0 }
            columnsEnd[ci] = item.endTotal
            placed = true
            break
          }
        }
        if(!placed){
          columnsEnd.push(item.endTotal)
          map[item.ev.activity_id] = { col: columnsEnd.length - 1, total: 0 }
        }
      }
      const totalCols = columnsEnd.length || 1
      // fill total for each event of this day
      for(const item of evs){
        if(map[item.ev.activity_id]) map[item.ev.activity_id].total = totalCols
      }
    }

    return map
  }, [activities])

  async function fetchActivities(){
    function formatDateLocal(d: Date){
      const y = d.getFullYear()
      const m = String(d.getMonth()+1).padStart(2,'0')
      const dd = String(d.getDate()).padStart(2,'0')
      return `${y}-${m}-${dd}`
    }
    const start = formatDateLocal(weekStart)
    const end = formatDateLocal(new Date(weekStart.getTime() + 6*24*60*60*1000))
    try{
      const res = await fetch(`${config.API_BASE}/activity?start_date=${start}&end_date=${end}`)
      if(res.ok){
        const data = await res.json()
        console.debug('[ActivityCalendar] fetched activities count=', Array.isArray(data)?data.length:0)
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
      } else {
        const txt = await res.text()
        console.error('[ActivityCalendar] fetch failed', res.status, txt)
      }
    }catch(e){
      console.error('[ActivityCalendar] network error while fetching activities', e)
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
    const evDate = parseISODateToLocal(ev.date)
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

    // apply column-based left/width if layout computed
    const layout = (layoutMap && (layoutMap as any)[ev.activity_id]) || null
    const style: React.CSSProperties = {
      top: `${top}px`,
      height: `${height}px`,
      position: 'absolute',
      background: bg,
      borderRadius: 10,
      color: textColor,
      paddingTop: 8,
      paddingLeft: 10,
      zIndex: 10
    }
    if(layout){
      const col = layout.col
      const total = layout.total || 1
      const widthPct = 100 / total
      const leftPct = col * widthPct
      style.left = `${leftPct}%`
      // subtract small gap
      style.width = `calc(${widthPct}% - 8px)`
      style.zIndex = 20 + col
    } else {
      style.left = '4px'
      style.right = '4px'
    }

    return (
      <div key={ev.activity_id} className={`ac-event ac-event-${dayIdx}`} style={style} title={ev.activity_name}>
        {calendarEditMode && (
          <div className="event-btns-wrapper" style={{position:'absolute', top:6, right:6, zIndex:60}}>
            <button className="event-edit-btn" onClick={(e)=>{ e.stopPropagation(); console.debug('[ActivityCalendar] edit click', ev); setEditingEvent(ev); setShowModal(true) }} aria-label="Edit event">✎</button>
            <button className="event-delete-btn" onClick={async (e)=>{ e.stopPropagation(); if(!confirm('Delete this event?')) return; try{ const id = (ev as any).activity_id ?? (ev as any).activityId ?? (ev as any).id; console.debug('[ActivityCalendar] delete id=', id); const res = await fetch(`${config.API_BASE}/activity/${id}`, { method: 'DELETE' }); if(res.ok){ await fetchActivities(); if(onEventCreated) onEventCreated() } else { const txt = await res.text().catch(()=>'<no body>'); console.error('[ActivityCalendar] delete failed', res.status, txt); alert('Delete failed: '+res.status+' '+txt) } }catch(err){ console.error('[ActivityCalendar] delete network error', err); alert('Network error') } }} aria-label="Delete event">✕</button>
          </div>
        )}
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
          {!calendarEditMode ? (
            <button className="edit-cal-btn" onClick={() => setCalendarEditMode(true)}>Edit</button>
          ) : (
            <div style={{display:'flex',gap:8}}>
              <button className="top-save-btn" onClick={() => setCalendarEditMode(false)} aria-label="Save">✓</button>
              <button className="top-cancel-btn" onClick={() => setCalendarEditMode(false)} aria-label="Cancel">✕</button>
            </div>
          )}
          <button className="new-button" onClick={()=>{ setEditingEvent(null); setShowModal(true) }}><span className="plus">+</span>New</button>
        </div>
      </div>

      <div className="week-nav">
        <div className="nav-group">
          <button className="nav-btn" onClick={prevWeek} aria-label="Previous week"> 
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15.8333 10.0001H4.16663M4.16663 10.0001L9.99996 15.8334M4.16663 10.0001L9.99996 4.16675" stroke="#5B5B5B" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="nav-btn" onClick={nextWeek} aria-label="Next week">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4.16671 10.0001H15.8334M15.8334 10.0001L10 15.8334M15.8334 10.0001L10 4.16675" stroke="#5B5B5B" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="days-row">
          {days.map((d,idx)=> (
            <div key={idx} className="day-header">
              <div className="day-name">{dayNames[idx]}</div>
              <div className="day-date">{d.getDate()}</div>
            </div>
          ))}
        </div>
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
                  const ad = parseISODateToLocal(a.date)
                  return ad.getFullYear()===d.getFullYear() && ad.getMonth()===d.getMonth() && ad.getDate()===d.getDate()
                }).map(ev => renderEvent(ev))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && <CreateEventModal existingEvent={editingEvent || undefined} onSaved={() => { fetchActivities().then(() => { if(onEventCreated) onEventCreated() }) }} onClose={() => { setShowModal(false); setEditingEvent(null); fetchActivities().then(() => { if(onEventCreated) onEventCreated() }) }} />}
    </div>
  )
}

export default ActivityCalendar
