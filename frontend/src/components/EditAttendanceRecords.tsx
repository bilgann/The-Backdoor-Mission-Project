import React, { useEffect, useState, useRef } from 'react'
import config from '../config'
import CardFrame from './CardFrame'
import SearchBar from './SearchBar'
import '../styles/AttendanceRecords.css'

const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const dayColors = ['#27608F','#FC8C37','#F6254F','#C3E4FF','#C3FFD7']

function parseISODateToLocal(dstr: string){
  if(!dstr) return new Date(dstr)
  const parts = dstr.split('-').map(p=>Number(p))
  if(parts.length >= 3){
    return new Date(parts[0], parts[1]-1, parts[2])
  }
  return new Date(dstr)
}

function startOfWeek(d: Date){
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0,0,0,0)
  return date
}

type ActivityItem = {
  activity_id: number
  activity_name: string
  date: string
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

interface Props {
  weekStart?: Date | null
  onDataChanged?: () => void
  refreshToken?: number
}

const EditAttendanceRecords: React.FC<Props> = ({ weekStart, onDataChanged, refreshToken }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [clientActs, setClientActs] = useState<ClientActivity[]>([])
  // per-day selected client (prevent shared input across cards)
  const [selectedClientNameMap, setSelectedClientNameMap] = useState<Record<number,string>>({})
  const [selectedClientIdMap, setSelectedClientIdMap] = useState<Record<number, number | null>>({})
  const [scoreDrafts, setScoreDrafts] = useState<Record<number, string>>({})
  const [cardEditModeMap, setCardEditModeMap] = useState<Record<number, boolean>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const CARD_GAP = 12
  const CARD_MIN_WIDTH = 280
  const [formActivityMap, setFormActivityMap] = useState<Record<number, number | null>>({})
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [selectOpenMap, setSelectOpenMap] = useState<Record<number, boolean>>({})

  useEffect(()=>{
    const ws = weekStart || startOfWeek(new Date())
    fetchForWeek(ws)
  }, [weekStart, refreshToken])

  async function fetchForWeek(ws: Date){
    const start = ws.toISOString().slice(0,10)
    const end = new Date(ws.getTime() + 6*24*60*60*1000).toISOString().slice(0,10)
    try{
      const [aRes, caRes] = await Promise.all([
        fetch(`${config.API_BASE}/activity?start_date=${start}&end_date=${end}`),
        fetch(`${config.API_BASE}/client_activity?start_date=${start}&end_date=${end}`)
      ])
      if(aRes.ok){
        const data = await aRes.json()
        setActivities(data)
      }
      if(caRes.ok){
        const ca = await caRes.json()
        setClientActs(ca)
      }
    }catch(e){
      // ignore
    }
  }

  // group activities Mon..Fri
  const groups: ActivityItem[][] = [[],[],[],[],[]]
  for(const a of activities){
    const ad = parseISODateToLocal(a.date)
    const dayIdx = (ad.getDay() === 0 ? 6 : ad.getDay()-1)
    if(dayIdx >=0 && dayIdx <=4) groups[dayIdx].push(a)
  }

  // update activeIndex based on scroll position so the dot reflects the visible card
  useEffect(() => {
    const el = containerRef.current
    if(!el) return
    const onScroll = () => {
      const center = el.scrollLeft + el.clientWidth / 2
      let closest = 0
      let closestDist = Infinity
      for(let i = 0; i < el.children.length; i++){
        const child = el.children[i] as HTMLElement
        const childCenter = child.offsetLeft + child.clientWidth / 2
        const dist = Math.abs(childCenter - center)
        if(dist < closestDist){ closest = i; closestDist = dist }
      }
      if(closest !== activeIndex) setActiveIndex(closest)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // call once to set initial
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [activities])

  // close select menus when clicking outside any select wrapper
  useEffect(() => {
    function onDocClick(e: MouseEvent){
      const tgt = e.target as HTMLElement | null
      if(!tgt) return
      // if click is inside any cf-select-wrapper, do nothing
      if(tgt.closest && tgt.closest('.cf-select-wrapper')) return
      // otherwise close all
      setSelectOpenMap({})
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // helpers to start/cancel/save edit mode per day
  function startEdit(dayIdx: number){
    const drafts: Record<number,string> = { ...scoreDrafts }
    const acts = groups[dayIdx] || []
    for(const a of acts){
      const parts = participantsForActivity(a.activity_id)
      for(const p of parts){
        drafts[p.client_activity_id] = p.score !== undefined && p.score !== null ? String(p.score) : ''
      }
    }
    console.log('startEdit', dayIdx, Object.keys(drafts).length, drafts)
    setScoreDrafts(drafts)
    setCardEditModeMap({ ...cardEditModeMap, [dayIdx]: true })
  }

  function cancelEdit(dayIdx: number){
    const drafts = { ...scoreDrafts }
    const acts = groups[dayIdx] || []
    for(const a of acts){
      const parts = participantsForActivity(a.activity_id)
      for(const p of parts){
        delete drafts[p.client_activity_id]
      }
    }
    setScoreDrafts(drafts)
    setCardEditModeMap({ ...cardEditModeMap, [dayIdx]: false })
  }

  async function saveDay(dayIdx: number){
    const acts = groups[dayIdx] || []
    const participants: ClientActivity[] = []
    for(const a of acts){
      participants.push(...participantsForActivity(a.activity_id))
    }
    // dedupe by record id
    const uniq = new Map<number, ClientActivity>()
    for(const p of participants) uniq.set(p.client_activity_id, p)

    const updates: Promise<any>[] = []
    for(const [id, p] of uniq){
      const draftStr = scoreDrafts[id]
      const current = p.score
      const draftVal = draftStr === '' ? null : Number(draftStr)
      const currVal = current === undefined ? null : current
      if((draftStr === '' && (currVal === null || currVal === undefined)) || (currVal === draftVal)){
        continue
      }
      updates.push(fetch(`${config.API_BASE}/client_activity/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ score: draftVal }) }))
    }

    try{
      await Promise.all(updates)
    }catch(e){
      alert('Failed to save one or more scores')
    }
    const ws = weekStart || startOfWeek(new Date())
    await fetchForWeek(ws)
    if(onDataChanged) onDataChanged()
    // clear drafts for this day
    const newDrafts = { ...scoreDrafts }
    for(const [id] of uniq) delete newDrafts[id]
    setScoreDrafts(newDrafts)
    setCardEditModeMap({ ...cardEditModeMap, [dayIdx]: false })
  }

  function participantsForActivity(activity_id: number){
    return clientActs.filter(ca=>ca.activity_id === activity_id)
  }

  async function submitAdd(activity_id: number, dayIdx: number){
    const selectedId = selectedClientIdMap[dayIdx] ?? null
    if(!selectedId) { alert('Please select a client'); return }
    // Prevent adding the same client to the same activity twice
    const already = clientActs.find(ca => ca.activity_id === activity_id && ca.client_id === selectedId)
    if(already){
      alert('This client is already added to that activity.')
      return
    }
    // use the current datetime for attendance record so ordering reflects submission time
    const payload = { client_id: selectedId, activity_id, date: new Date().toISOString() }
    try{
      const res = await fetch(`${config.API_BASE}/client_activity`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      if(res.ok){
        const ws = weekStart || startOfWeek(new Date())
        await fetchForWeek(ws)
        if(onDataChanged) onDataChanged()
        // clear only this day's selection
        setSelectedClientIdMap({ ...selectedClientIdMap, [dayIdx]: null })
        setSelectedClientNameMap({ ...selectedClientNameMap, [dayIdx]: '' })
      } else {
        const txt = await res.text()
        alert('Failed to add attendee: '+txt)
      }
    }catch(e){ alert('Network error') }
  }



  return (
    <div className="edit-attendance-root">
      <div className="edit-attendance-wrapper">
        <button 
          className="btn small" 
          onClick={() => {
            const el = containerRef.current
            if(!el) return
            const amount = Math.round(el.clientWidth * 0.8)
            const target = Math.max(0, el.scrollLeft - amount)
            el.scrollTo({ left: target, behavior: 'smooth' })
          }} 
          aria-label="Previous"
          style={{background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0}}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15.8333 10.0001H4.16663M4.16663 10.0001L9.99996 15.8334M4.16663 10.0001L9.99996 4.16675" stroke="#5B5B5B" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="edit-attendance-scroll-wrapper" style={{overflow:'hidden', minWidth: 0}}>
          <div 
            ref={containerRef} 
            className="edit-attendance-scroll"
            style={{display:'flex', gap: CARD_GAP, paddingBottom:6, overflowX:'auto', scrollBehavior:'smooth'}}
          >
            {groups.map((g, dayIdx) => (
              <div key={dayIdx} style={{minWidth:CARD_MIN_WIDTH, flex:'0 0 auto'}}>
                <CardFrame className="attendance-day-card">
                  <div className="attendance-day-inner">
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, fontWeight:600}}>
                        <div>{dayNames[dayIdx]}</div>
                        <div className="day-color-indicator" style={{width:12, height:12, borderRadius:6, background: dayColors[dayIdx]}} />
                      </div>
                      <div>
                        {!cardEditModeMap[dayIdx] ? (
                          <button className="btn small edit-card-btn" onClick={()=>startEdit(dayIdx)}>edit</button>
                        ) : (
                          <div style={{display:'flex', gap:8}}>
                            <button className="top-save-btn" onClick={()=>saveDay(dayIdx)} aria-label="Save">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <rect width="16" height="16" rx="8" fill="#DEFFA8" />
                                <path d="M13.3333 4L5.99996 11.3333L2.66663 8" stroke="#A4E934" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            <button className="top-cancel-btn" onClick={()=>cancelEdit(dayIdx)} aria-label="Cancel">✕</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="attendance-day-main">
                      <div style={{flex:1}}>
                        <div className="attendance-day-table">
                          <table className="records-table small">
                          <thead>
                            <tr><th>Activity</th><th>Client</th><th>Date</th><th>Score</th></tr>
                          </thead>
                          <tbody>
                            {g.length === 0 ? (
                              <tr><td colSpan={4} style={{color:'#777', padding:'6px 8px'}}>No activities</td></tr>
                            ) : g.map(act => (
                              <React.Fragment key={act.activity_id}>
                                <tr className="activity-row">
                                  <td colSpan={4} style={{fontWeight:600}}>{act.activity_name}</td>
                                </tr>
                                {participantsForActivity(act.activity_id).length === 0 ? (
                                  <tr><td colSpan={4} style={{paddingLeft:12, color:'#777'}}>No attendees</td></tr>
                                ) : participantsForActivity(act.activity_id).map(p => (
                                  <tr key={p.client_activity_id}>
                                    <td style={{paddingLeft:12}}>{act.activity_name}</td>
                                    <td>{p.client_name ?? `#${p.client_id}`}</td>
                                    <td>{new Date(p.date).toLocaleString()}</td>
                                    <td>
                                      {cardEditModeMap[dayIdx] ? (
                                        <input
                                          className="score-input-edit"
                                          type="number"
                                          min={1}
                                          max={10}
                                          value={scoreDrafts[p.client_activity_id] ?? (p.score !== undefined && p.score !== null ? String(p.score) : '')}
                                          onChange={(e)=>{ const v = (e.target as HTMLInputElement).value; setScoreDrafts({ ...scoreDrafts, [p.client_activity_id]: v }) }}
                                          onFocus={() => console.log('score input focus', p.client_activity_id)}
                                          onClick={() => console.log('score input click', p.client_activity_id)}
                                          style={{pointerEvents:'auto'}}
                                        />
                                      ) : (
                                        <span>{p.score ?? '-'}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="attendance-right" style={{width:220}}>
                        <div style={{fontWeight:600, marginBottom:6}}>Add attendee</div>
                        <div style={{display:'flex', flexDirection:'column', gap:8}}>
                          <div style={{fontSize:12, color:'#444'}}>Select client</div>
                          <SearchBar
                            variant="form"
                            placeholder="Search client"
                            value={selectedClientNameMap[dayIdx] ?? ''}
                            onChange={(v)=>{ setSelectedClientNameMap({ ...selectedClientNameMap, [dayIdx]: v }); setSelectedClientIdMap({ ...selectedClientIdMap, [dayIdx]: null }) }}
                            onSelect={(m)=>{ setSelectedClientIdMap({ ...selectedClientIdMap, [dayIdx]: Number(m.id) }); setSelectedClientNameMap({ ...selectedClientNameMap, [dayIdx]: m.name }) }}
                            inputClassName="cf-input"
                          />

                          <div style={{fontSize:12, color:'#444'}}>Select activity</div>
                          <div className="cf-select-wrapper" data-day-select={dayIdx}>
                            <button
                              type="button"
                              className="cf-select-button"
                              onClick={(e)=>{ e.stopPropagation(); setSelectOpenMap({ ...selectOpenMap, [dayIdx]: !selectOpenMap[dayIdx] }) }}
                              aria-haspopup="listbox"
                              aria-expanded={!!selectOpenMap[dayIdx]}
                            >
                              <span className={formActivityMap[dayIdx] ? '' : 'cf-select-placeholder'}>
                                {formActivityMap[dayIdx]
                                  ? (g.find(a=>a.activity_id === formActivityMap[dayIdx])?.activity_name ?? 'Choose Activity') +
                                    ` (${new Date((g.find(a=>a.activity_id === formActivityMap[dayIdx])?.date) ?? '').toLocaleString()})`
                                  : 'Choose Activity'}
                              </span>
                              <span className="cf-select-caret">▾</span>
                            </button>

                            {selectOpenMap[dayIdx] && (
                              <ul className="cf-select-menu" role="listbox">
                                <li className="cf-select-option" role="option" onClick={()=>{ setFormActivityMap({...formActivityMap, [dayIdx]: null}); setSelectOpenMap({ ...selectOpenMap, [dayIdx]: false }) }}>Choose Activity</li>
                                {g.map(a => (
                                  <li key={a.activity_id} className="cf-select-option" role="option" onClick={()=>{ setFormActivityMap({...formActivityMap, [dayIdx]: Number(a.activity_id)}); setSelectOpenMap({ ...selectOpenMap, [dayIdx]: false }) }}>
                                    {a.activity_name} ({new Date(a.date).toLocaleString()})
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div style={{display:'flex', gap:8}}>
                            <button className="btn add-attendee" onClick={()=>{ const actId = formActivityMap[dayIdx]; if(actId) { submitAdd(actId, dayIdx) } else { alert('Select an activity') } }} disabled={!(selectedClientIdMap[dayIdx])}>Add</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardFrame>
              </div>
            ))}
          </div>
        </div>

        <button 
          className="btn small" 
          onClick={() => {
            const el = containerRef.current
            if(!el) return
            const amount = Math.round(el.clientWidth * 0.8)
            const target = Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + amount)
            el.scrollTo({ left: target, behavior: 'smooth' })
          }} 
          aria-label="Next"
          style={{background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0}}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4.16671 10.0001H15.8334M15.8334 10.0001L10 15.8334M15.8334 10.0001L10 4.16675" stroke="#5B5B5B" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="carousel-dots">
        {groups.map((_, i) => (
          <button
            key={i}
            className={`carousel-dot ${i === activeIndex ? 'active' : ''}`}
            onClick={()=>{
              const el = containerRef.current
              if(!el) return
              const child = el.children[i] as HTMLElement
              if(child) el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' })
              setActiveIndex(i)
            }}
            aria-label={`Go to ${dayNames[i]}`}
            aria-pressed={i === activeIndex}
          />
        ))}
      </div>
    </div>
  )
}

export default EditAttendanceRecords
