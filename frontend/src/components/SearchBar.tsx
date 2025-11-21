import React, { useState, useEffect, useRef } from 'react'
import config from '../config'
import '../styles/SearchBar.css'

// SearchBar component: reusable search input with icon and dropdown for matches.
// - Shows placeholder with magnifier icon and styled per design.
// - When user types, it queries a backend search endpoint and shows matches.
// - The dropdown has background color #F7FFF0.

interface MatchItem {
  id: number | string
  name: string
  nickname?: string | null
}

const SearchBar: React.FC<{
  placeholder?: string
  onSelect?: (item: MatchItem) => void
  // optional: make the input look like form inputs by passing variant="form" and an inputClassName like 'cf-input'
  variant?: 'default' | 'form'
  inputClassName?: string
  // optional controlled value and change handler
  value?: string
  onChange?: (v: string) => void
}> = ({ placeholder = 'type here', onSelect, variant = 'default', inputClassName = '', value, onChange }) => {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const justSelectedRef = useRef(false)

  useEffect(() => {
    const effectiveQuery = value !== undefined ? value : query

    // If a match was just clicked, suppress the automatic search/fetch
    if (justSelectedRef.current) {
      // clear matches but keep the input value visible
      setMatches([])
      // do not change `open` here; the click handler will have closed it
      return
    }

    if (!effectiveQuery) {
      setMatches([])
      setOpen(false)
      return
    }

    // Debounce simple client-side
    const t = setTimeout(async () => {
      try {
        // Call backend search endpoint (expects JSON array of matches)
        const res = await fetch(`${config.API_BASE}/api/clients?query=${encodeURIComponent(effectiveQuery)}`)
        if (!res.ok) {
          setMatches([])
          setOpen(false)
          return
        }
        const json = await res.json()
        // Backend returns objects like { client_id, full_name, gender }
        // Map to the dropdown shape expected here: { id, name }
        const mapped = (json || []).map((c: any) => ({
          id: c.client_id ?? c.id,
          name: c.full_name ?? c.name ?? '',
          nickname: c.nickname ?? null
        }))
        setMatches(mapped)
        setOpen(mapped.length > 0)
      } catch (e) {
        setMatches([])
        setOpen(false)
      }
    }, 300)

    return () => clearTimeout(t)
  }, [query, value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  return (
    <div className="searchbar-container" ref={containerRef}>
      <div className={"searchbar-input" + (variant === 'form' ? ' form' : '')}>
        {/* magnifier icon - hide when using form variant so input visually matches other form inputs */}
        {variant !== 'form' && (
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" className="searchbar-icon">
            <path d="M14.875 14.875L11.7938 11.7938M13.4583 7.79167C13.4583 10.9213 10.9213 13.4583 7.79167 13.4583C4.66205 13.4583 2.125 10.9213 2.125 7.79167C2.125 4.66205 4.66205 2.125 7.79167 2.125C10.9213 2.125 13.4583 4.66205 13.4583 7.79167Z" stroke="#2B4118" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        <input
          className={`searchbar-text ${inputClassName}`.trim()}
          value={value !== undefined ? value : query}
          onChange={(e) => {
            const v = e.target.value
            if (onChange) onChange(v)
            else setQuery(v)
            setOpen(true)
          }}
          placeholder={placeholder}
        />
      </div>

      {/* dropdown for matches */}
      {open && matches.length > 0 && (
        <div className="searchbar-dropdown">
          {matches.map((m) => (
            <div key={m.id} className="searchbar-item" onClick={() => {
              // prevent the effect from immediately re-fetching and reopening the dropdown
              justSelectedRef.current = true
              setTimeout(() => { justSelectedRef.current = false }, 350)
              // Notify parent of selection. Do NOT call onChange here - calling onChange
              // after onSelect caused consuming components to clear selected IDs.
              onSelect && onSelect(m)
              setOpen(false)
            }}>
              <div className="searchbar-item-main">
                <div className="searchbar-item-name">
                  {m.name} {m.nickname ? <span className="searchbar-item-nick">({m.nickname})</span> : null}
                </div>
                <div className="searchbar-item-meta">client id: {m.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchBar
