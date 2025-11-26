import React, { useEffect, useState } from "react";
import "../styles/CoatCheck.css";
import "../styles/Clients.css";
import config from "../config";
import RecordText from "../components/RecordText";
import ResponsiveTable from "../components/ResponsiveTable";
import CoatCheckPanel from '../components/CoatCheckPanel';
import SearchBar from '../components/SearchBar';
import ActionButton from '../components/ActionButton';
import CardFrame from '../components/CardFrame';


const CoatCheck: React.FC = () => {

    const [rows, setRows] = useState<any[]>([])
    const [selectedClient, setSelectedClient] = useState<null | { id: string | number; name: string }>(null);
    const [binNo, setBinNo] = useState<number | string>('');
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
            const resp = await fetch(`${config.API_BASE}/coat_check_records`)
            const data = await resp.json()

            // fetch clients to map names (single request)
            const clientsResp = await fetch(`${config.API_BASE}/api/clients`)
            const clientsList = await clientsResp.json()
            const clientMap: { [k: number]: string } = {}
            if (Array.isArray(clientsList)) {
                clientsList.forEach((c: any) => { clientMap[c.client_id] = c.full_name })
            }

            const mapped = (data || []).map((r: any) => ({
                id: r.check_id,
                name: clientMap[r.client_id] || `Client #${r.client_id}`,
                bin_no: Number(r.bin_no) || 0,
                date: r.date,
                time_in: formatTime(r.time_in),
                time_out: r.time_out ? formatTime(r.time_out) : '',
                raw_time_in: r.time_in,
                raw_time_out: r.time_out
            }))

            // Build 20 bin placeholders (1..20)
            const bins: any[] = Array.from({ length: 20 }, (_, i) => ({
                id: null,
                name: '',
                bin_no: i + 1,
                date: '',
                time_in: '',
                time_out: '',
                raw_time_in: null,
                raw_time_out: null
            }))

            // Merge mapped records into placeholders by bin_no, but only keep active items (no time_out)
            mapped.forEach((rec: any) => {
                const bn = Number(rec.bin_no) || 0
                if (bn >= 1 && bn <= 20) {
                    // If item has been timed out (returned), skip it
                    if (!rec.raw_time_out) {
                        bins[bn - 1] = rec
                    }
                }
            })

            // ensure ascending order by bin_no
            bins.sort((a: any, b: any) => (Number(a.bin_no) || 0) - (Number(b.bin_no) || 0))

            setRows(bins)
        } catch (e) {
            setRows([])
        }
    }

    useEffect(() => {
        fetchRows()
    }, [])

    return (
        <div className="coat-check-page">
            <h1 className="page-title">Coat Check</h1>

            <div className="number-of-clients-graph">
                    <CoatCheckPanel />
            </div>

            <div className="coat-check-row">
                <div className="coat-check-left">
                    <div className="heading-text recent-label" style={{ marginTop: 20 }}>Recent Coat Check Records</div>

                    <div className="recent-table-wrapper">
                        <ResponsiveTable
                            columns={[
                                    { key: 'bin_no', label: 'Bin No' },
                                    { key: 'name', label: 'Name' },
                                    { key: 'date', label: 'Date' },
                                    { key: 'time_in', label: 'Time In' },
                                    { key: 'time_out', label: 'Time Out' },
                                ]}
                            rows={rows}
                            noDataText={<RecordText>No recent data</RecordText> as any}
                            renderCell={(row, key) => {
                                if (key === 'name') return <RecordText>{row.name}</RecordText>
                                if (key === 'bin_no') return <RecordText>{row.bin_no}</RecordText>
                                if (key === 'date') return <RecordText>{row.date}</RecordText>
                                if (key === 'time_in') return <RecordText>{row.time_in}</RecordText>
                                if (key === 'time_out') {
                                    // Show time-out button only for records that were just submitted
                                    if (!row.raw_time_out && row.justSubmitted) {
                                        return (
                                            <ActionButton
                                                onClick={async () => {
                                                    if (!row.id) return
                                                    setUpdatingId(row.id)
                                                    try {
                                                        const now = new Date()
                                                        const res = await fetch(`${config.API_BASE}/coat_check_records/${row.id}`, {
                                                            method: 'PUT',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ time_out: now.toISOString() })
                                                        })
                                                        if (!res.ok) {
                                                            const err = await res.json().catch(() => ({}))
                                                            console.error('Update coat check time_out error response:', err)
                                                            alert('Failed to set time out: ' + (err.error || err.message || res.statusText))
                                                        } else {
                                                            await fetchRows()
                                                            // notify other components to refresh their stats
                                                            try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                                        }
                                                    } catch (e) {
                                                        alert('Failed to set time out')
                                                    } finally {
                                                        setUpdatingId(null)
                                                    }
                                                }}
                                                className="coatcheck-timeout"
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
                </div>

                <div className="coat-check-right">
                    <div className="heading-text recent-label">Enter Record</div>
                    <CardFrame className="client-form-card">
                        <div className="client-form-inner">
                            

                            <label className="cf-label">Full name <span className="cf-required">*</span></label>
                            <div>
                                <SearchBar variant="form" inputClassName="cf-input" placeholder="Search clients" onSelect={(item) => setSelectedClient({ id: item.id, name: item.name })} />
                            </div>

                            <label className="cf-label">Bin no</label>
                            <div className="number-input-with-arrows">
                                <input
                                    className="cf-input no-spinner"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Bin no"
                                    value={binNo}
                                    onChange={(e) => setBinNo(String(e.target.value).replace(/\D/g, ''))}
                                />
                                <div className="num-arrows">
                                    <button
                                        type="button"
                                        className="num-arrow num-arrow-up"
                                        onClick={() => {
                                            const n = Number(binNo) || 0
                                            if (n < 100) setBinNo(String(n + 1))
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
                                            const n = Number(binNo) || 0
                                            if (n > 1) setBinNo(String(n - 1))
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
                                    if (!binNo) {
                                        alert('Please enter bin number')
                                        return
                                    }

                                    setSubmitting(true)
                                    try {
                                        const now = new Date()
                                        const payload = {
                                            client_id: Number(selectedClient.id),
                                            bin_no: Number(binNo),
                                            time_in: now.toISOString(),
                                            date: now.toISOString().slice(0,10)
                                        }
                                        const res = await fetch(`${config.API_BASE}/coat_check_records`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        })
                                                        if (!res.ok) {
                                                            const err = await res.json().catch(() => ({}))
                                                            console.error('Create coat check record error response:', err)
                                                            alert('Failed to create record: ' + (err.error || err.message || res.statusText))
                                                        } else {
                                                            // refresh rows
                                                            await fetchRows()
                                                            // mark the submitted bin so timeout button can be shown for this new record
                                                            setRows(prev => prev.map(r => (Number(r.bin_no) === Number(payload.bin_no) ? { ...r, justSubmitted: true } : r)))
                                                            // notify other components (totals, panels) to refresh
                                                            try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                                            // reset inputs
                                                            setSelectedClient(null)
                                                            setBinNo('')
                                                        }
                                    } catch (e) {
                                        alert('Failed to create record')
                                    } finally {
                                        setSubmitting(false)
                                    }
                                }}
                                className="cf-submit coatcheck-submit"
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

export default CoatCheck

