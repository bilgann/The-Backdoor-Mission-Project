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
  const [fullName, setFullName] = useState<string>('')
  const [nicknameInput, setNicknameInput] = useState<string>('')
  const [birthYearInput, setBirthYearInput] = useState<string>('')
  const [suggestions, setSuggestions] = useState<Array<any>>([])
  const [suggestOpen, setSuggestOpen] = useState<boolean>(false)
  const searchTimer = useRef<number | null>(null)
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
      full_name: String(fd.get('full_name') || fullName).trim(),
      gender: String(fd.get('gender') || gender).trim() || null,
      nickname: String(fd.get('nickname') || nicknameInput).trim() || null,
      birth_year: birthYearInput ? Number(birthYearInput) : null
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
        setFullName('')
        setNicknameInput('')
        setBirthYearInput('')
        setSuggestions([])
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

  const fetchSuggestions = async (q: string) => {
    try {
      const res = await fetch(`${config.API_BASE}/api/clients/suggest?query=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data || [])
        setSuggestOpen((data || []).length > 0)
      } else {
        setSuggestions([])
        setSuggestOpen(false)
      }
    } catch (e) {
      setSuggestions([])
      setSuggestOpen(false)
    }
  }

  const onNameChange = (v: string) => {
    setFullName(v)
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    if (!v || v.trim().length < 2) {
      setSuggestions([])
      setSuggestOpen(false)
      return
    }
    // debounce
    searchTimer.current = window.setTimeout(() => {
      fetchSuggestions(v.trim())
    }, 300)
  }

  return (
    <CardFrame className="client-form-card">
      <form className="client-form-inner" onSubmit={handleSubmit}>
        <label className="cf-label">Full name <span className="cf-required">*</span></label>
        <input name="full_name" className="cf-input" required value={fullName} onChange={(e) => onNameChange(e.target.value)} />

        {suggestOpen && suggestions.length > 0 && (
          <div className="cf-suggestions">
            <div className="cf-suggestions-title">Possible existing clients</div>
            <ul>
              {suggestions.map((s) => (
                <li key={s.client_id} className="cf-suggestion-row">
                  <div className="cf-suggestion-main">
                    <div className="cf-suggestion-full">Full name: {s.full_name} {s.nickname ? <span className="cf-suggestion-nick">({s.nickname})</span> : null}</div>
                    <div className="cf-suggestion-id">Client ID: {s.client_id}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="cf-label">Nickname (preferred name)</label>
        <input name="nickname" className="cf-input" value={nicknameInput} onChange={(e) => setNicknameInput(String(e.target.value))} />

        <label className="cf-label">Birth year</label>
        <input name="birth_year" className="cf-input" value={birthYearInput} onChange={(e) => setBirthYearInput(e.target.value)} />

        <label className="cf-label">Gender</label>
        <div className="cf-select-wrapper" ref={wrapperRef}>
          <button
            type="button"
            className="cf-select-button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {gender ? gender : <span className="cf-select-placeholder">Select gender</span>}
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 25 25" fill="none" className="cf-select-caret">
              <path d="M6.25 9.375L12.5 15.625L18.75 9.375" stroke="#B3B3B3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
              <li
                role="option"
                tabIndex={0}
                className="cf-select-option"
                onClick={() => { setGender('NB'); setOpen(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setGender('NB'); setOpen(false) } }}
              >
                NB
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
