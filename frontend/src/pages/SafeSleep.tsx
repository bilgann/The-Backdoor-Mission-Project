import React, { useEffect, useState, useRef } from "react";
import "../styles/CoatCheck.css";
import "../styles/Clients.css";
import "../styles/SafeSleep.css";
import config from "../config";
import RecordText from "../components/RecordText";
import ResponsiveTable from "../components/ResponsiveTable";
import SafeSleepPanel from "../components/SafeSleepPanel";
import SearchBar from '../components/SearchBar';
import ActionButton from '../components/ActionButton';
import CardFrame from '../components/CardFrame';


const SafeSleep: React.FC = () => {

    // always show 20 ascending bed placeholders
    const initialBeds: any[] = Array.from({ length: 20 }, (_, i) => ({
        id: null,
        name: '',
        bed_no: i + 1,
        date: '',
        is_occupied: false
    }))
    const [rows, setRows] = useState<any[]>(initialBeds)
    const [selectedClient, setSelectedClient] = useState<null | { id: string | number; name: string }>(null);
    const [bedNo, setBedNo] = useState<number | string>('');
    const [submitting, setSubmitting] = useState(false);

    // keep optimistic local timestamps per bed_no so a subsequent server GET
    // that returns a date-only value doesn't overwrite the exact click-time
    const optimisticTimestamps = useRef<Record<number, string>>({})

    

    const fetchRows = async () => {
        try {
            // fetch safe sleep records
            const resp = await fetch(`${config.API_BASE}/safe_sleep_records`)
            const data = await resp.json()

            // fetch clients to map names (single request)
            let clientsList: any[] = []
            try {
                const clientsResp = await fetch(`${config.API_BASE}/api/clients`)
                clientsList = await clientsResp.json()
            } catch (e) {
                clientsList = []
            }
            const clientMap: { [k: number]: string } = {}
            if (Array.isArray(clientsList)) {
                clientsList.forEach((c: any) => { clientMap[c.client_id] = c.full_name })
            }

            // snapshot current rows so we can preserve optimistic timestamps
            const prevRowsSnapshot = rows || []
            const fetched = (data || []).map((r: any) => {
                const id = r.sleep_id ?? r.id ?? r.safe_sleep_id ?? r.record_id
                const bedNoNum = Number(r.bed_no) || 0
                const serverRaw = r.date || null

                // If server returned a full ISO with time ('T'), use it and clear any
                // optimistic timestamp for that bed. Otherwise, prefer an optimistic
                // local display timestamp (if present) so the UI shows the exact
                // time the user clicked Submit.
                let displayDate = ''
                if (serverRaw && String(serverRaw).includes('T')) {
                    displayDate = new Date(serverRaw).toLocaleString('en-US')
                    try { delete optimisticTimestamps.current[bedNoNum] } catch (e) {}
                } else {
                    const optimistic = optimisticTimestamps.current[bedNoNum]
                    if (optimistic) {
                        displayDate = optimistic
                    } else if (serverRaw) {
                        // server returned a date-only string; show a localized date/time
                        displayDate = new Date(serverRaw).toLocaleString('en-US')
                    } else {
                        displayDate = ''
                    }
                }

                return {
                    id,
                    name: clientMap[r.client_id] || `Client #${r.client_id}`,
                    bed_no: bedNoNum,
                    date: displayDate,
                    raw_date: serverRaw,
                    is_occupied: !!r.is_occupied
                }
            })

            // build 20 bed placeholders (1..20)
            const beds: any[] = Array.from({ length: 20 }, (_, i) => ({
                id: null,
                name: '',
                bed_no: i + 1,
                date: '',
                is_occupied: false
            }))

            // merge fetched records into placeholders by bed_no (overwrite) but only place occupied records
            fetched.forEach((rec: any) => {
                const bn = Number(rec.bed_no)
                if (bn >= 1 && bn <= 20 && rec.is_occupied) {
                    beds[bn - 1] = rec
                }
            })

            // ensure ascending order
            beds.sort((a, b) => (Number(a.bed_no) || 0) - (Number(b.bed_no) || 0))

            setRows(beds)
        } catch (e) {
            console.error('Failed to fetch safe sleep records', e)
            // show placeholders on error
            setRows(initialBeds)
        }
    }

    useEffect(() => {
        fetchRows()
    }, [])

    return (
        <div className="safe-sleep-page">
            <h1 className="page-title">Safe Sleep</h1>

            <div className="number-of-clients-graph">
                    <SafeSleepPanel />
            </div>

            <div className="safe-sleep-row">
                <div className="safe-sleep-left">
                    <div className="heading-text recent-label" style={{ marginTop: 20 }}>Available Beds</div>

                    <div className="recent-table-wrapper">
                        <ResponsiveTable
                            columns={[
                                { key: 'bed_no', label: 'Bed No' },
                                { key: 'name', label: 'Name' },
                                { key: 'date', label: 'Date' },
                                { key: 'is_occupied', label: 'Occupied' },
                            ]}
                            rows={rows}
                            noDataText={<RecordText>No recent data</RecordText> as any}
                            renderCell={(row, key) => {
                                if (key === 'bed_no') return <RecordText>{row.bed_no}</RecordText>
                                if (key === 'name') return <RecordText>{row.name}</RecordText>
                                if (key === 'date') return <RecordText>{row.date}</RecordText>
                                if (key === 'is_occupied') {
                                    const occupied = !!row.is_occupied
                                    return (
                                        <div style={{ textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                className={`safe-sleep-occupied ${occupied ? 'occupied-yes' : 'occupied-no'}`}
                                                onClick={async () => {
                                                                    if (!row.id) return
                                                                    try {
                                                                        if (occupied) {
                                                                            // mark as not occupied but keep the record for history
                                                                            const upd = await fetch(`${config.API_BASE}/safe_sleep_records/${row.id}`, {
                                                                                method: 'PUT',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ is_occupied: false })
                                                                            })
                                                                            if (!upd.ok) {
                                                                                const err = await upd.json().catch(() => ({}))
                                                                                console.error('Update safe sleep record error response:', err)
                                                                                alert('Failed to clear bed')
                                                                            } else {
                                                                                                                // Optimistically remove the record from the occupied table (KEEP it in the DB).
                                                                                                                                            const bn = Number(row.bed_no)
                                                                                                                                            // clear optimistic timestamp for this bed
                                                                                                                                            try { delete optimisticTimestamps.current[bn] } catch (e) {}
                                                                                                                                            setRows(prev => {
                                                                                                                                                const copy = [...prev]
                                                                                                                                                if (bn >= 1 && bn <= 20) {
                                                                                                                                                    copy[bn - 1] = { id: null, name: '', bed_no: bn, date: '', is_occupied: false }
                                                                                                                                                }
                                                                                                                                                return copy
                                                                                                                                            })
                                                                                                                try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                                                                                                // background reconcile
                                                                                                                fetchRows()
                                                                            }
                                                                        } else {
                                                                            // not occupied - do nothing (use submit to occupy)
                                                                        }
                                                                    } catch (e) {
                                                                        alert('Failed to update occupied status')
                                                                    }
                                                                }}
                                            >
                                                {occupied ? 'Yes' : 'No'}
                                            </button>
                                        </div>
                                    )
                                }
                                return <RecordText>{row[key]}</RecordText>
                            }}
                        />
                    </div>
                </div>

                <div className="safe-sleep-right">
                    <div className="heading-text recent-label">Enter Record</div>
                    <CardFrame className="client-form-card">
                        <div className="client-form-inner">
                            

                            <label className="cf-label">Full name <span className="cf-required">*</span></label>
                            <div>
                                <SearchBar variant="form" inputClassName="cf-input" placeholder="Search clients" onSelect={(item) => setSelectedClient({ id: item.id, name: item.name })} />
                            </div>

                            <label className="cf-label">Bed no</label>
                            <div className="number-input-with-arrows">
                                <input
                                    className="cf-input no-spinner"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Bed no"
                                    value={bedNo}
                                    onChange={(e) => setBedNo(String(e.target.value).replace(/\D/g, ''))}
                                />
                                <div className="num-arrows">
                                    <button
                                        type="button"
                                        className="num-arrow num-arrow-up"
                                        onClick={() => {
                                            const n = Number(bedNo) || 0
                                            if (n < 100) setBedNo(String(n + 1))
                                        }}
                                        aria-label="increase"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="8" viewBox="0 0 14 8" fill="none">
                                            <path d="M13 6.75L6.75 0.5L0.5 6.75" stroke="#B3B3B3" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        className="num-arrow num-arrow-down"
                                        onClick={() => {
                                            const n = Number(bedNo) || 0
                                            if (n > 1) setBedNo(String(n - 1))
                                        }}
                                        aria-label="decrease"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="8" viewBox="0 0 14 8" fill="none">
                                            <path d="M13 0.5L6.75 6.75L0.5 0.500001" stroke="#B3B3B3" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div style={{ height: 8 }} />
                            <ActionButton
                                onClick={async () => {
                                    if (!selectedClient || !selectedClient.id) {
                                        alert('Please select a client from the search results')
                                        return
                                    }
                                    if (!bedNo) {
                                        alert('Please enter bed number')
                                        return
                                    }

                                    const bedNumber = Number(bedNo)
                                    if (!Number.isFinite(bedNumber) || bedNumber < 1 || bedNumber > 20) {
                                        alert('Bed number must be a number between 1 and 20')
                                        return
                                    }

                                    // prevent duplicate occupied bed entries
                                    if (rows.some(r => Number(r.bed_no) === Number(bedNo) && r.is_occupied)) {
                                        alert('That bed is currently occupied. Please choose another bed or mark it as available first.')
                                        return
                                    }

                                    setSubmitting(true)
                                    try {
                                        const now = new Date()
                                        const payload = {
                                            client_id: Number(selectedClient.id),
                                            bed_no: bedNumber,
                                            is_occupied: true,
                                            // backend now expects `date` as an ISO datetime including time
                                            date: now.toISOString()
                                        }

                                        // log payload for debugging if needed
                                        console.debug('SafeSleep submit payload:', payload)
                                        const res = await fetch(`${config.API_BASE}/safe_sleep_records`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        })
                                        let responseBody: any = null
                                        try {
                                            responseBody = await res.json()
                                        } catch (_) {
                                            try { responseBody = await res.text() } catch (_) { responseBody = null }
                                        }
                                        if (!res.ok) {
                                            console.error('Create safe sleep record failed', res.status, responseBody)
                                            const details = responseBody && typeof responseBody === 'object' ? (responseBody.error || responseBody.message || JSON.stringify(responseBody)) : responseBody
                                            alert(`Failed to create record (status ${res.status}): ${details || res.statusText}`)
                                        } else {
                                            // update rows optimistically so UI reflects the new occupied bed immediately
                                            try {
                                                const newId = responseBody && (responseBody.sleep_id || responseBody.sleepId || responseBody.id)
                                                // use the local `now` instead of parsing the ISO string so the display shows
                                                // the exact local time the user clicked Submit (avoid server-side truncation)
                                                const displayNow = new Date().toLocaleString('en-US')
                                                // store optimistic display timestamp so fetchRows can prefer it
                                                optimisticTimestamps.current[bedNumber] = displayNow
                                                const newRow = {
                                                    id: newId || null,
                                                    name: selectedClient.name,
                                                    bed_no: bedNumber,
                                                    date: displayNow,
                                                    raw_date: payload.date,
                                                    is_occupied: true
                                                }
                                                setRows(prev => {
                                                    const copy = [...prev]
                                                    if (bedNumber >= 1 && bedNumber <= 20) {
                                                        copy[bedNumber - 1] = newRow
                                                    }
                                                    return copy
                                                })

                                                // notify other components (totals, panels) to refresh
                                                try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}

                                                // reset inputs
                                                setSelectedClient(null)
                                                setBedNo('')

                                                // also trigger a background refresh to reconcile with server state
                                                fetchRows()
                                            } catch (e) {
                                                // fallback: refresh from server if optimistic update fails
                                                await fetchRows()
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Create safe sleep record exception', e)
                                        alert('Failed to create record')
                                    } finally {
                                        setSubmitting(false)
                                    }
                                }}
                                className="cf-submit safe-sleep-submit"
                            >
                                {submitting ? 'Saving...' : 'Submit'}
                            </ActionButton>
                            
                        </div>
                    </CardFrame>
                    <div style={{ height: 12 }} />
                    <CardFrame className="client-form-card occupancy-card">
                        <div>
                            <div style={{
                                color: '#000',
                                fontFamily: 'Satoshi Variable',
                                fontSize: 20,
                                fontStyle: 'normal',
                                fontWeight: 400,
                                lineHeight: '120%',
                                letterSpacing: '-0.6px',
                                marginBottom: 10
                            }}>Occupancy Rate</div>

                            <div style={{
                                color: '#000',
                                fontFamily: 'Satoshi Variable',
                                fontSize: 32,
                                fontStyle: 'normal',
                                fontWeight: 400,
                                lineHeight: '120%',
                                letterSpacing: '-0.96px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                {(() => {
                                    const occupiedCount = (rows || []).filter((r: any) => !!r.is_occupied).length
                                    const pct = Math.round((occupiedCount / 20) * 100)
                                    // determine color by thresholds:
                                    // 0-25%  => #95F492 (most available)
                                    // 26-49% => #EDF373 (getting occupied but below 50%)
                                    // 50-75% => #FFAB6B (around 75% occupied)
                                    // 76-100% => #FF2752 (very full)
                                    let color = '#95F492'
                                    if (pct > 25 && pct < 50) color = '#EDF373'
                                    else if (pct >= 50 && pct <= 75) color = '#FFAB6B'
                                    else if (pct > 75) color = '#FF2752'

                                    return (
                                        <>
                                            <span>{pct}%</span>
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    display: 'inline-block',
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: '50%',
                                                    background: color,
                                                    boxShadow: '0 0 0 1px rgba(0,0,0,0.06) inset'
                                                }}
                                            />
                                        </>
                                    )
                                })()}
                            </div>
                        </div>
                    </CardFrame>
                </div>
            </div>
        </div>
        
    )
}

export default SafeSleep

