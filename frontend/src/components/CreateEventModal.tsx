import React, { useState } from 'react'
import config from '../config'
import '../styles/Activity.css'

type Props = { onClose: ()=>void, existingEvent?: any, onSaved?: () => void }

const CreateEventModal: React.FC<Props> = ({ onClose, existingEvent, onSaved }) => {
  function formatDateLocal(d: Date){
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${dd}`
  }
  const [activityName, setActivityName] = useState('')
  const [date, setDate] = useState(formatDateLocal(new Date()))
  const [startTime, setStartTime] = useState('13:00')
  const [endTime, setEndTime] = useState('14:00')
  const [attendance, setAttendance] = useState(0)
  const colors = ['#C3E4FF','#C3FFD7','#FC8C37','#F6254F','#27608F','#FFED7A']
  const [color, setColor] = useState<string>(colors[0])

  React.useEffect(()=>{
    if(existingEvent){
      const ev = existingEvent
      console.debug('[CreateEventModal] mounting with existingEvent', ev)
      setActivityName(ev.activity_name || ev.activityName || '')
      if(ev.date) setDate(ev.date)
      try{
        if(ev.start_time){
          const sd = new Date(ev.start_time)
          const sh = String(sd.getHours()).padStart(2,'0')
          const sm = String(sd.getMinutes()).padStart(2,'0')
          setStartTime(`${sh}:${sm}`)
        }
        if(ev.end_time){
          const ed = new Date(ev.end_time)
          const eh = String(ed.getHours()).padStart(2,'0')
          const em = String(ed.getMinutes()).padStart(2,'0')
          setEndTime(`${eh}:${em}`)
        }
      }catch(e){}
      if((ev as any).color) setColor((ev as any).color)
    }
  }, [existingEvent])

  async function submit(e: React.FormEvent){
    e.preventDefault()
    const payload = {
      activity_name: activityName,
      date,
      start_time: `${date}T${startTime}:00`,
      end_time: `${date}T${endTime}:00`
    }
    try{
      // Validate: do not create an event with the exact same start and end time on the same day
      try{
        const chkRes = await fetch(`${config.API_BASE}/activity?start_date=${date}&end_date=${date}`)
        if(chkRes.ok){
          const existing = await chkRes.json()
          const newStart = `${date}T${startTime}:00`
          const newEnd = `${date}T${endTime}:00`
          const dup = (existing || []).some((ev: any) => {
            // some backends use start_time/end_time or startTime/endTime
            const evStart = ev.start_time || ev.startTime || ''
            const evEnd = ev.end_time || ev.endTime || ''
            return evStart === newStart && evEnd === newEnd
          })
          if(dup){
            alert('An event already exists at that exact start and end time on this date.')
            return
          }
        }
      }catch(err){ /* ignore validation failure and continue to allow server-side validation */ }
      let res
      const editId = (existingEvent && ((existingEvent.activity_id ?? existingEvent.activityId ?? existingEvent.id)))
      if(editId){
        // edit existing
        console.debug('[CreateEventModal] submitting PUT for id', editId, payload)
        res = await fetch(`${config.API_BASE}/activity/${editId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      } else {
        console.debug('[CreateEventModal] submitting POST', payload)
        res = await fetch(`${config.API_BASE}/activity`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      }
      console.debug('[CreateEventModal] response status', res.status)
      if(res.ok){
        // read created id and store local color mapping before closing
        try{
          const body = await res.json().catch(()=>null)
          console.debug('[CreateEventModal] response body', body)
          const id = body && (body.activity_id || body.activityId || body.id) || (existingEvent && existingEvent.activity_id)
          if(id){
            const map = JSON.parse(localStorage.getItem('activityColors') || '{}')
            map[id] = color
            localStorage.setItem('activityColors', JSON.stringify(map))
          }
        }catch(e){
          console.warn('[CreateEventModal] failed to parse response body', e)
        }
        if(onSaved) onSaved()
        onClose()
      } else {
        const txt = await res.text()
        console.error('Create event failed', {status: res.status, body: txt})
        alert('Error creating event: '+txt)
      }
    }catch(err){
      // log to console for easier debugging in dev tools
      console.error('Network error when creating event', err)
      alert('Network error: could not reach the backend. Check that the backend is running at ' + config.API_BASE)
    }
  }

  return (
    <div className="ac-modal-overlay">
      <div className="ac-modal">
        <h3>{existingEvent ? 'Edit Event' : 'Create Event'}</h3>
        <form onSubmit={submit} className="ac-form">
          <label>Title
            <input value={activityName} onChange={e=>setActivityName(e.target.value)} required />
          </label>
          <label>Date
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} required />
          </label>
          <label>Start
            <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} required />
          </label>
          <label>End
            <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} required />
          </label>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div>
              <div style={{fontSize:13,marginBottom:6}}>Pick a color</div>
              <div style={{display:'flex',gap:8}}>
                {colors.map(c=> (
                  <button type="button" key={c} onClick={()=>setColor(c)} aria-label={c} style={{width:28,height:28,borderRadius:5,background:c,border: c===color? '3px solid #000' : '1px solid #ccc',padding:0}} />
                ))}
              </div>
            </div>
            <div className="ac-form-actions">
            <button type="button" className="ac-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="ac-btn ac-btn-primary">{existingEvent ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateEventModal
