import React, { useEffect, useState, useRef } from "react";
import "../styles/Washroom.css";
import "../styles/Clients.css";
import config from "../config";
import RecordText from "../components/RecordText";
import ResponsiveTable from "../components/ResponsiveTable";
import WashroomPanel from '../components/WashroomPanel';
import SearchBar from '../components/SearchBar';
import ActionButton from '../components/ActionButton';
import CardFrame from '../components/CardFrame';


const Washroom: React.FC = () => {

    const [rows, setRows] = useState<any[]>([])
    const [selectedClient, setSelectedClient] = useState<null | { id: string | number; name: string }>(null);
    const selectedClientRef = React.useRef<null | { id: string | number; name: string }>(null)
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [washroomType, setWashroomType] = useState<string>('');
    const [showOptions, setShowOptions] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState(false);
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const formatTime = (iso?: string | null) => {
        if (!iso) return ''
        try {
            const d = new Date(iso)
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
        } catch (e) {
            return iso as any
        }
    }

    const fetchRows = async () => {
        try {
            const resp = await fetch(`${config.API_BASE}/washroom_records`)
            const data = await resp.json()

            // fetch clients to map names (single request)
            const clientsResp = await fetch(`${config.API_BASE}/api/clients`)
            const clientsList = await clientsResp.json()
            const clientMap: { [k: number]: string } = {}
            if (Array.isArray(clientsList)) {
                clientsList.forEach((c: any) => { clientMap[c.client_id] = c.full_name })
            }

            const mapped = (data || []).map((r: any) => ({
                id: r.washroom_id,
                name: clientMap[r.client_id] || `Client #${r.client_id}`,
                washroom_type: r.washroom_type,
                date: r.date,
                time_in: formatTime(r.time_in),
                time_out: r.time_out ? formatTime(r.time_out) : '',
                raw_time_in: r.time_in,
                raw_time_out: r.time_out
            }))

            mapped.sort((a: any, b: any) => {
                const ta = a.raw_time_in ? new Date(a.raw_time_in).getTime() : 0
                const tb = b.raw_time_in ? new Date(b.raw_time_in).getTime() : 0
                return tb - ta
            })

            setRows(mapped.slice(0, 10))
        } catch (e) {
            setRows([])
        }
    }

    useEffect(() => {
        fetchRows()
    }, [])

    // split rows by washroom type
    const rowsA = rows.filter(r => String(r.washroom_type).toUpperCase() === 'A')
    const rowsB = rows.filter(r => String(r.washroom_type).toUpperCase() === 'B')

    // find currently open record (no time_out) per type
    const openA = rowsA.find(r => !r.raw_time_out)
    const openB = rowsB.find(r => !r.raw_time_out)

    // timer state per type (countdown in seconds from 10 minutes)
    // default to 10 minutes (600s) when no open record
    const DEFAULT_SECONDS = 10 * 60
    const [remainingA, setRemainingA] = useState<number>(DEFAULT_SECONDS)
    const [remainingB, setRemainingB] = useState<number>(DEFAULT_SECONDS)
    // track which record we've auto-closed so we don't hit the API twice (use refs)
    const autoClosedARef = useRef<number | null>(null)
    const autoClosedBRef = useRef<number | null>(null)

    useEffect(() => {
        let ia: any = null
        if (openA && openA.raw_time_in) {
            const start = new Date(openA.raw_time_in).getTime()
            const target = start + 10 * 60 * 1000 // 10 minutes
            const update = () => {
                const secs = Math.max(0, Math.ceil((target - Date.now()) / 1000))
                setRemainingA(secs)
                // auto-timeout when it reaches zero
                if (secs <= 0 && openA.id && autoClosedARef.current !== openA.id) {
                    autoClosedARef.current = openA.id
                    // set time_out to target (the 10 minute mark)
                    (async () => {
                        setUpdatingId(openA.id)
                        try {
                            const res = await fetch(`${config.API_BASE}/washroom_records/${openA.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ time_out: new Date(target).toISOString() })
                            })
                            if (!res.ok) {
                                console.error('Auto-timeout failed for A', await res.text())
                            } else {
                                await fetchRows()
                                try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                            }
                        } catch (e) {
                            console.error('Auto-timeout exception for A', e)
                        } finally {
                            setUpdatingId(null)
                        }
                    })()
                    // stop the interval after auto-timeout
                    if (ia) {
                        clearInterval(ia)
                        ia = null
                    }
                }
            }
            update()
            ia = setInterval(update, 1000)
        } else {
            setRemainingA(DEFAULT_SECONDS)
            autoClosedARef.current = null
        }
        return () => { if (ia) clearInterval(ia) }
    }, [openA?.raw_time_in, openA?.id])

    useEffect(() => {
        let ib: any = null
        if (openB && openB.raw_time_in) {
            const start = new Date(openB.raw_time_in).getTime()
            const target = start + 10 * 60 * 1000 // 10 minutes
            const update = () => {
                const secs = Math.max(0, Math.ceil((target - Date.now()) / 1000))
                setRemainingB(secs)
                if (secs <= 0 && openB.id && autoClosedBRef.current !== openB.id) {
                    autoClosedBRef.current = openB.id
                    (async () => {
                        setUpdatingId(openB.id)
                        try {
                            const res = await fetch(`${config.API_BASE}/washroom_records/${openB.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ time_out: new Date(target).toISOString() })
                            })
                            if (!res.ok) {
                                console.error('Auto-timeout failed for B', await res.text())
                            } else {
                                await fetchRows()
                                try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                            }
                        } catch (e) {
                            console.error('Auto-timeout exception for B', e)
                        } finally {
                            setUpdatingId(null)
                        }
                    })()
                    // stop the interval after auto-timeout
                    if (ib) {
                        clearInterval(ib)
                        ib = null
                    }
                }
            }
            update()
            ib = setInterval(update, 1000)
        } else {
            setRemainingB(DEFAULT_SECONDS)
            autoClosedBRef.current = null
        }
        return () => { if (ib) clearInterval(ib) }
    }, [openB?.raw_time_in, openB?.id])

    const fmt = (s: number) => {
        const mm = Math.floor(s/60).toString().padStart(2,'0')
        const ss = (s%60).toString().padStart(2,'0')
        return `${mm}:${ss}`
    }

    return (
        <div className="washroom-page">
            <h1 className="page-title">Washroom</h1>

                <div className="number-of-clients-graph">
                    <WashroomPanel />
                </div>

            <div className="washroom-row">
                <div className="washroom-left">
                    <div style={{ marginTop: 20 }}>
                        <div className="heading-text recent-label">Washroom A Records</div>
                        <div className="recent-table-wrapper">
                            <ResponsiveTable
                                columns={[
                                    { key: 'name', label: 'Name' },
                                    { key: 'washroom_type', label: 'Washroom Type' },
                                    { key: 'date', label: 'Date' },
                                    { key: 'time_in', label: 'Time In' },
                                    { key: 'time_out', label: 'Time Out' },
                                ]}
                                rows={rowsA}
                                noDataText={<RecordText>No recent data</RecordText> as any}
                                renderCell={(row, key) => {
                                    if (key === 'name') return <RecordText>{row.name}</RecordText>
                                    if (key === 'washroom_type') return <RecordText>{row.washroom_type}</RecordText>
                                    if (key === 'date') return <RecordText>{row.date}</RecordText>
                                    if (key === 'time_in') return <RecordText>{row.time_in}</RecordText>
                                    if (key === 'time_out') {
                                        if (!row.raw_time_out) {
                                            return (
                                                <ActionButton
                                                    onClick={async () => {
                                                        if (!row.id) return
                                                        setUpdatingId(row.id)
                                                        try {
                                                            const now = new Date()
                                                            const res = await fetch(`${config.API_BASE}/washroom_records/${row.id}`, {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ time_out: now.toISOString() })
                                                            })
                                                            if (!res.ok) {
                                                                const err = await res.json().catch(() => ({}))
                                                                console.error('Update washroom time_out error response:', err)
                                                                alert('Failed to set time out: ' + (err.error || err.message || res.statusText))
                                                            } else {
                                                                await fetchRows()
                                                                try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                                            }
                                                        } catch (e) {
                                                            alert('Failed to set time out')
                                                        } finally {
                                                            setUpdatingId(null)
                                                        }
                                                    }}
                                                    className="washroom-timeout"
                                                >
                                                    {updatingId === row.id ? 'Saving...' : 'time out'}
                                                </ActionButton>
                                            )
                                        }
                                        return <RecordText>{row.time_out}</RecordText>
                                    }
                                    return <RecordText>{row[key]}</RecordText>
                                }}
                            />
                        </div>

                        {/* Timer for Washroom A directly under its table */}
                        <div style={{ height: 8 }} />
                        <div className="washroom-timer-heading">Washroom A Timer</div>
                        <CardFrame className="washroom-timer-card">
                            <div className="washroom-timer-row">
                                <div className="washroom-timer-time">{fmt(remainingA)}</div>
                                <ActionButton
                                    onClick={async () => {
                                        if (!openA || !openA.id) {
                                            alert('No open Washroom A record to time out')
                                            return
                                        }
                                        setUpdatingId(openA.id)
                                        try {
                                            const now = new Date()
                                            const res = await fetch(`${config.API_BASE}/washroom_records/${openA.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ time_out: now.toISOString() })
                                            })
                                            if (!res.ok) {
                                                const err = await res.json().catch(() => ({}))
                                                alert('Failed to set time out: ' + (err.error || err.message || res.statusText))
                                            } else {
                                                await fetchRows()
                                                try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                            }
                                        } catch (e) {
                                            alert('Failed to set time out')
                                        } finally {
                                            setUpdatingId(null)
                                        }
                                    }}
                                    className="washroom-timer-button"
                                >
                                    time out
                                </ActionButton>
                            </div>
                        </CardFrame>

                        {/* Table for B below A */}
                        <div style={{ marginTop: 18 }}>
                            <div className="heading-text recent-label">Washroom B Records</div>
                            <div className="recent-table-wrapper">
                                <ResponsiveTable
                                    columns={[
                                        { key: 'name', label: 'Name' },
                                        { key: 'washroom_type', label: 'Washroom Type' },
                                        { key: 'date', label: 'Date' },
                                        { key: 'time_in', label: 'Time In' },
                                        { key: 'time_out', label: 'Time Out' },
                                    ]}
                                    rows={rowsB}
                                    noDataText={<RecordText>No recent data</RecordText> as any}
                                    renderCell={(row, key) => {
                                        if (key === 'name') return <RecordText>{row.name}</RecordText>
                                        if (key === 'washroom_type') return <RecordText>{row.washroom_type}</RecordText>
                                        if (key === 'date') return <RecordText>{row.date}</RecordText>
                                        if (key === 'time_in') return <RecordText>{row.time_in}</RecordText>
                                        if (key === 'time_out') {
                                            if (!row.raw_time_out) {
                                                return (
                                                    <ActionButton
                                                        onClick={async () => {
                                                            if (!row.id) return
                                                            setUpdatingId(row.id)
                                                            try {
                                                                const now = new Date()
                                                                const res = await fetch(`${config.API_BASE}/washroom_records/${row.id}`, {
                                                                    method: 'PUT',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ time_out: now.toISOString() })
                                                                })
                                                                if (!res.ok) {
                                                                    const err = await res.json().catch(() => ({}))
                                                                    console.error('Update washroom time_out error response:', err)
                                                                    alert('Failed to set time out: ' + (err.error || err.message || res.statusText))
                                                                } else {
                                                                    await fetchRows()
                                                                    try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                                                }
                                                            } catch (e) {
                                                                alert('Failed to set time out')
                                                            } finally {
                                                                setUpdatingId(null)
                                                            }
                                                        }}
                                                        className="washroom-timeout"
                                                    >
                                                        {updatingId === row.id ? 'Saving...' : 'time out'}
                                                    </ActionButton>
                                                )
                                            }
                                            return <RecordText>{row.time_out}</RecordText>
                                        }
                                        return <RecordText>{row[key]}</RecordText>
                                    }}
                                />
                            </div>
                        {/* Timer for Washroom B directly under its table */}
                        <div style={{ height: 8 }} />
                        <div className="washroom-timer-heading">Washroom B Timer</div>
                        <CardFrame className="washroom-timer-card">
                            <div className="washroom-timer-row">
                                <div className="washroom-timer-time">{fmt(remainingB)}</div>
                                <ActionButton
                                    onClick={async () => {
                                        if (!openB || !openB.id) {
                                            alert('No open Washroom B record to time out')
                                            return
                                        }
                                        setUpdatingId(openB.id)
                                        try {
                                            const now = new Date()
                                            const res = await fetch(`${config.API_BASE}/washroom_records/${openB.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ time_out: now.toISOString() })
                                            })
                                            if (!res.ok) {
                                                const err = await res.json().catch(() => ({}))
                                                alert('Failed to set time out: ' + (err.error || err.message || res.statusText))
                                            } else {
                                                await fetchRows()
                                                try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                            }
                                        } catch (e) {
                                            alert('Failed to set time out')
                                        } finally {
                                            setUpdatingId(null)
                                        }
                                    }}
                                    className="washroom-timer-button"
                                >
                                    time out
                                </ActionButton>
                            </div>
                        </CardFrame>
                        </div>
                    </div>
                </div>

                <div className="washroom-right">
                    <div className="heading-text recent-label">Enter Record</div>
                    <CardFrame className="client-form-card">
                        <div className="client-form-inner">
                            

                            <label className="cf-label">Full name <span className="cf-required">*</span></label>
                            <div>
                                <SearchBar
                                    variant="form"
                                    inputClassName="cf-input"
                                    placeholder="Search clients"
                                    value={searchQuery}
                                    onChange={(v) => {
                                        setSearchQuery(v);
                                        // only clear selectedClient if the typed value no longer matches the selected client's name
                                        if (!selectedClientRef.current || selectedClientRef.current.name !== v) {
                                            setSelectedClient(null)
                                            selectedClientRef.current = null
                                        }
                                    }}
                                    onSelect={(item) => {
                                        const sel = { id: item.id, name: item.name }
                                        setSelectedClient(sel)
                                        selectedClientRef.current = sel
                                        setSearchQuery(item.name)
                                    }}
                                />
                            </div>

                            <label className="cf-label">Washroom Type <span className="cf-required">*</span></label>
                            <div className="cf-select-wrapper">
                                <button
                                    type="button"
                                    className="cf-select-button cf-input"
                                    onClick={() => setShowOptions((s) => !s)}
                                >
                                    <span className="cf-select-placeholder">{washroomType || 'Select type'}</span>
                                    <span className="cf-select-caret">▾</span>
                                </button>

                                {showOptions && (
                                    <ul className="cf-select-menu" role="listbox">
                                        <li className="cf-select-option" onClick={() => { setWashroomType('A'); setShowOptions(false); }}>A</li>
                                        <li className="cf-select-option" onClick={() => { setWashroomType('B'); setShowOptions(false); }}>B</li>
                                    </ul>
                                )}
                            </div>

                            <div style={{ height: 8 }} />
                            <ActionButton
                                onClick={async () => {
                                    if (!selectedClient || !selectedClient.id) {
                                        alert('Please select a client from the search results')
                                        return
                                    }
                                    if (!washroomType) {
                                        alert('Please select washroom type')
                                        return
                                    }

                                    // Prevent creating a record if the selected washroom type is currently occupied
                                    try {
                                        const allResp = await fetch(`${config.API_BASE}/washroom_records`)
                                        const allData = await allResp.json().catch(() => [])
                                        const occupied = (allData || []).find((r: any) => r.washroom_type === washroomType && !r.time_out)
                                        if (occupied) {
                                            alert(`Washroom ${washroomType} is currently occupied. Please wait until it's timed out.`)
                                            return
                                        }
                                    } catch (e) {
                                        // if the pre-check fails, continue but warn
                                        console.warn('Could not verify washroom occupancy before creating record', e)
                                    }

                                    setSubmitting(true)
                                    try {
                                        const now = new Date()
                                        const payload = {
                                            client_id: Number(selectedClient.id),
                                            washroom_type: washroomType,
                                            time_in: now.toISOString(),
                                            date: now.toISOString().slice(0,10)
                                        }
                                        const res = await fetch(`${config.API_BASE}/washroom_records`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        })
                                                        if (!res.ok) {
                                                            const err = await res.json().catch(() => ({}))
                                                            console.error('Create washroom record error response:', err)
                                                            alert('Failed to create record: ' + (err.error || err.message || res.statusText))
                                        } else {
                                            // refresh rows
                                            await fetchRows()
                                                            // notify other components (totals, panels) to refresh
                                                            try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                            // reset inputs
                                            setSelectedClient(null)
                                            setSearchQuery('')
                                            setWashroomType('')
                                        }
                                    } catch (e) {
                                        alert('Failed to create record')
                                    } finally {
                                        setSubmitting(false)
                                    }
                                }}
                                className="cf-submit washroom-submit"
                            >
                                {submitting ? 'Saving...' : 'Submit'}
                            </ActionButton>
                            {/* timers removed from form area; timers are rendered below each table */}
                        </div>
                    </CardFrame>
                </div>
            </div>
        </div>
        
    )
}

export default Washroom;

