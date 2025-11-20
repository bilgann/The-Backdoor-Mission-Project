import React, { useState } from 'react'
import config from '../config'
import '../styles/Activity.css'

type Props = { onClose: ()=>void }

const CreateEventModal: React.FC<Props> = ({ onClose }) => {
  const [activityName, setActivityName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [startTime, setStartTime] = useState('13:00')
  const [endTime, setEndTime] = useState('14:00')
  const [attendance, setAttendance] = useState(0)
  const colors = ['#C3E4FF','#C3FFD7','#FC8C37','#F6254F','#27608F','#FFED7A']
  const [color, setColor] = useState<string>(colors[0])

  async function submit(e: React.FormEvent){
    e.preventDefault()
    const payload = {
      activity_name: activityName,
      date,
      start_time: `${date}T${startTime}:00`,
      end_time: `${date}T${endTime}:00`
    }
    try{
      const res = await fetch(`${config.API_BASE}/activity`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
      })
      if(res.ok){
        // read created id and store local color mapping before closing
        try{
          const body = await res.json()
          const id = body && (body.activity_id || body.activityId || body.id)
          if(id){
            const map = JSON.parse(localStorage.getItem('activityColors') || '{}')
            map[id] = color
            localStorage.setItem('activityColors', JSON.stringify(map))
          }
        }catch(e){
          // ignore parsing errors
        }
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
        <h3>Create Event</h3>
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
          <label>Attendance
            <input type="number" min={0} value={attendance} onChange={e=>setAttendance(Number(e.target.value))} style={{display:'none'}} />
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
            <button type="submit" className="ac-btn ac-btn-primary">Create</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateEventModal
