import React, { useEffect, useState, useRef } from 'react'
import "../styles/Clinic.css"
import "../styles/CoatCheck.css"
import config from '../config'
import RecordText from '../components/RecordText'
import ResponsiveTable from '../components/ResponsiveTable'
import ClinicPanel from  '../components/ClinicPanel'
import SearchBar from '../components/SearchBar'
import ActionButton from '../components/ActionButton'
import CardFrame from '../components/CardFrame'

const Clinic: React.FC = () => {
    const [rows, setRows] = useState<any[]>([])
    const [selectedClient, setSelectedClient] = useState<null | { id: string | number; name: string }>(null)
    const selectedClientRef = useRef<null | { id: string | number; name: string }>(null)
    const [purpose, setPurpose] = useState<string>('')
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)

    const fetchRows = async () => {
        try {
            const resp = await fetch(`${config.API_BASE}/clinic_records`)
            const data = await resp.json()

            // fetch clients to map names
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

            const mapped = (data || []).map((r: any) => ({
                id: r.clinic_id,
                name: clientMap[r.client_id] || `Client #${r.client_id}`,
                date: r.date ? new Date(r.date).toLocaleString() : '',
                purpose_of_visit: r.purpose_of_visit || ''
            }))

            mapped.sort((a: any, b: any) => {
                const parseToTs = (d: any) => {
                    try {
                        if (!d) return 0
                        // numeric timestamps
                        if (typeof d === 'number') return d
                        if (typeof d === 'string') {
                            // normalize common date/time formats so Date can parse reliably
                            // if it has a space between date and time (e.g. "2025-11-19 12:34:56"),
                            // replace the first space with 'T' to make it ISO-like
                            let s = d.trim()
                            if (s.includes('T')) return new Date(s).getTime()
                            if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:?\d{0,2}/.test(s)) {
                                s = s.replace(/\s+/, 'T')
                                return new Date(s).getTime() || 0
                            }
                            // if it's a date-only string like YYYY-MM-DD, append midnight
                            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).getTime() || 0
                            return new Date(s).getTime() || 0
                        }
                        return new Date(d).getTime() || 0
                    } catch (e) {
                        return 0
                    }
                }

                const ta = parseToTs(a.date)
                const tb = parseToTs(b.date)
                // primary: descending by timestamp (newest first)
                const byDate = tb - ta
                if (byDate !== 0) return byDate
                // secondary: descending by id if available so newer records with same date show first
                const ida = Number(a.id || 0)
                const idb = Number(b.id || 0)
                return idb - ida
            })

            setRows(mapped.slice(0, 10))
        } catch (e) {
            setRows([])
        }
    }

    useEffect(() => {
        fetchRows()
    }, [])

    return (
        <div className="clinic-page">
            <h1 className="page-title">Clinic</h1>

            <div className="number-of-clients-graph">
                <ClinicPanel />
            </div>

            <div className="clinic-row">
                <div className="clinic-left">
                    <div style={{ marginTop: 20 }}>
                        <div className="heading-text recent-label">Recent Clinic Records</div>
                        <div className="recent-table-wrapper">
                            <ResponsiveTable
                                columns={[
                                    { key: 'name', label: 'Name' },
                                    { key: 'date', label: 'Date' },
                                    { key: 'purpose_of_visit', label: 'Purpose of Visit' }
                                ]}
                                rows={rows}
                                noDataText={<RecordText>No recent data</RecordText> as any}
                                renderCell={(row, key) => {
                                    if (key === 'name') return <RecordText>{row.name}</RecordText>
                                    if (key === 'date') return <RecordText>{row.date}</RecordText>
                                    if (key === 'purpose_of_visit') return <RecordText>{row.purpose_of_visit}</RecordText>
                                    return <RecordText>{row[key]}</RecordText>
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="clinic-right">
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
                                        setSearchQuery(v)
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

                            <label className="cf-label">Purpose of visit <span className="cf-required">*</span></label>
                            <input
                                className="cf-input"
                                placeholder="Purpose of visit"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                            />

                            <div style={{ height: 8 }} />
                            <ActionButton
                                onClick={async () => {
                                    if (!selectedClient || !selectedClient.id) {
                                        alert('Please select a client from the search results')
                                        return
                                    }
                                    if (!purpose || String(purpose).trim().length === 0) {
                                        alert('Please enter purpose of visit')
                                        return
                                    }

                                    setSubmitting(true)
                                    try {
                                        const now = new Date()
                                        // Build a local (timezone-naive) ISO-like datetime string
                                        // `YYYY-MM-DDTHH:MM:SS` so the backend stores the same
                                        // clock hour/minute the user clicked, rather than
                                        // converting between timezones.
                                        const pad = (n: number) => String(n).padStart(2, '0')
                                        const localIsoNoMs = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
                                        const payload = {
                                            client_id: Number(selectedClient.id),
                                            purpose_of_visit: String(purpose).trim(),
                                            date: localIsoNoMs
                                        }

                                        console.debug('Create clinic payload:', payload)
                                        const res = await fetch(`${config.API_BASE}/clinic_records`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        })

                                        let body: any = null
                                        try { body = await res.json() } catch (_) { body = null }
                                        console.debug('Create clinic response body:', body)
                                        if (!res.ok) {
                                            const details = body && typeof body === 'object' ? (body.error || body.message || JSON.stringify(body)) : body
                                            alert(`Failed to create record (status ${res.status}): ${details || res.statusText}`)
                                        } else {
                                            // Optimistically insert the new record at the top so
                                            // the most-recent item appears first without waiting
                                            // for the background refresh. Also trigger a
                                            // background fetch to reconcile with the server.
                                            try {
                                                const newId = body && (body.clinic_id || body.id) ? (body.clinic_id || body.id) : null
                                                const newRow = {
                                                    id: newId,
                                                    name: selectedClient.name,
                                                    date: payload.date ? new Date(payload.date).toLocaleString() : '',
                                                    purpose_of_visit: payload.purpose_of_visit
                                                }
                                                setRows(prev => {
                                                    const copy = [newRow, ...(prev || [])]
                                                    return copy.slice(0, 10)
                                                })
                                            } catch (e) {
                                                // ignore optimistic insertion errors
                                            }

                                            // notify panels and reconcile in background
                                            try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                            fetchRows()

                                            setSelectedClient(null)
                                            selectedClientRef.current = null
                                            setSearchQuery('')
                                            setPurpose('')
                                        }
                                    } catch (e) {
                                        console.error('Create clinic record exception', e)
                                        alert('Failed to create record')
                                    } finally {
                                        setSubmitting(false)
                                    }
                                }}
                                className="cf-submit clinic-submit"
                            >
                                {submitting ? 'Saving...' : 'Submit'}
                            </ActionButton>
                        </div>
                    </CardFrame>
                </div>
            </div>
        </div>
    )
}

export default Clinic

