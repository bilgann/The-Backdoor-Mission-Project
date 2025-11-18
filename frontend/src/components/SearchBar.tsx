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
}

const SearchBar: React.FC<{
  placeholder?: string
  onSelect?: (item: MatchItem) => void
}> = ({ placeholder = 'type here', onSelect }) => {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!query) {
      setMatches([])
      setOpen(false)
      return
    }

    // Debounce simple client-side
    const t = setTimeout(async () => {
      try {
        // Call backend search endpoint (expects JSON array of matches)
        const res = await fetch(`${config.API_BASE}/api/clients?query=${encodeURIComponent(query)}`)
        if (!res.ok) return
        const json = await res.json()
        // Backend returns objects like { client_id, full_name, gender }
        // Map to the dropdown shape expected here: { id, name }
        const mapped = (json || []).map((c: any) => ({
          id: c.client_id ?? c.id,
          name: c.full_name ?? c.name ?? ''
        }))
        setMatches(mapped)
        setOpen(mapped.length > 0)
      } catch (e) {
        setMatches([])
        setOpen(false)
      }
    }, 300)

    return () => clearTimeout(t)
  }, [query])

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
      <div className="searchbar-input">
        {/* magnifier icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" className="searchbar-icon">
          <path d="M14.875 14.875L11.7938 11.7938M13.4583 7.79167C13.4583 10.9213 10.9213 13.4583 7.79167 13.4583C4.66205 13.4583 2.125 10.9213 2.125 7.79167C2.125 4.66205 4.66205 2.125 7.79167 2.125C10.9213 2.125 13.4583 4.66205 13.4583 7.79167Z" stroke="#2B4118" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          className="searchbar-text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          placeholder={placeholder}
        />
      </div>

      {/* dropdown for matches */}
      {open && matches.length > 0 && (
        <div className="searchbar-dropdown">
          {matches.map((m) => (
            <div key={m.id} className="searchbar-item" onClick={() => { onSelect && onSelect(m); setOpen(false); setQuery('') }}>
              <div className="searchbar-item-name">{m.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchBar
