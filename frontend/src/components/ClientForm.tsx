import React, { useState, useRef, useEffect } from 'react'
import CardFrame from './CardFrame'
import '../styles/ClientForm.css'
import config from '../config'

interface Props {
  onSuccess?: () => void
}

const ClientForm: React.FC<Props> = ({ onSuccess }) => {
  const [gender, setGender] = useState<string>('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload: any = {
      full_name: String(fd.get('full_name') || '').trim(),
      gender: String(fd.get('gender') || gender).trim() || null
    }
    try {
      const res = await fetch(`${config.API_BASE}/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        form.reset()
        setGender('')
        if (onSuccess) onSuccess()
        alert('Client created')
      } else {
        const err = await res.json().catch(() => ({}))
        alert('Failed to create client: ' + (err.message || res.statusText))
      }
    } catch (err) {
      alert('Failed to create client')
    }
  }

  return (
    <CardFrame className="client-form-card">
      <form className="client-form-inner" onSubmit={handleSubmit}>
        <label className="cf-label">Full name</label>
        <input name="full_name" className="cf-input" required />

        <label className="cf-label">Gender</label>
        <div className="cf-select-wrapper" ref={wrapperRef}>
          <button
            type="button"
            className="cf-select-button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {gender || 'Select gender'}
            <span className="cf-select-caret">▾</span>
          </button>

          <input type="hidden" name="gender" value={gender} />

          {open && (
            <ul className="cf-select-menu" role="listbox">
              <li
                role="option"
                tabIndex={0}
                className="cf-select-option"
                onClick={() => { setGender('F'); setOpen(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setGender('F'); setOpen(false) } }}
              >
                F
              </li>
              <li
                role="option"
                tabIndex={0}
                className="cf-select-option"
                onClick={() => { setGender('M'); setOpen(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setGender('M'); setOpen(false) } }}
              >
                M
              </li>
            </ul>
          )}
        </div>

        <div style={{ height: 8 }} />
        <button type="submit" className="cf-submit">submit</button>
      </form>
    </CardFrame>
  )
}

export default ClientForm
