import React, { useEffect, useState } from "react";
import "../styles/CoatCheck.css";
import "../styles/Clients.css";
import "../styles/Sanctuary.css";
import config from "../config";
import RecordText from "../components/RecordText";
import ResponsiveTable from "../components/ResponsiveTable";
import SanctuaryPanel from '../components/SanctuaryPanel';
import SearchBar from '../components/SearchBar';
import ActionButton from '../components/ActionButton';
import CardFrame from '../components/CardFrame';


const Sanctuary: React.FC = () => {

    const [rows, setRows] = useState<any[]>([])
    const [selectedClient, setSelectedClient] = useState<null | { id: string | number; name: string }>(null);
    const [purposeOfVisit, setPurposeOfVisit] = useState<string>('');
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
            const resp = await fetch(`${config.API_BASE}/sanctuary_records`)
            const data = await resp.json()

            // fetch clients to map names (single request)
            const clientsResp = await fetch(`${config.API_BASE}/api/clients`)
            const clientsList = await clientsResp.json()
            const clientMap: { [k: number]: string } = {}
            if (Array.isArray(clientsList)) {
                clientsList.forEach((c: any) => { clientMap[c.client_id] = c.full_name })
            }

            const mapped = (data || []).map((r: any) => ({
                id: r.sanctuary_id,
                name: clientMap[r.client_id] || `Client #${r.client_id}`,
                purpose_of_visit: r.purpose_of_visit || '',
                date: r.date,
                time_in: formatTime(r.time_in),
                time_out: r.time_out ? formatTime(r.time_out) : '',
                raw_time_in: r.time_in,
                raw_time_out: r.time_out,
                if_serviced: !!r.if_serviced
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

    return (
        <div className="sanctuary-page">
            <h1 className="page-title">Sanctuary</h1>

            <div className="number-of-clients-graph">
                    <SanctuaryPanel />
            </div>

            <div className="coat-check-row">
                <div className="coat-check-left">
                    <div className="heading-text recent-label" style={{ marginTop: 20 }}>Recent Sanctuary Records</div>

                    <div className="recent-table-wrapper">
                        <ResponsiveTable
                            columns={[
                                { key: 'name', label: 'Name' },
                                { key: 'purpose_of_visit', label: 'Purpose Of Visit' },
                                { key: 'date', label: 'Date' },
                                { key: 'time_in', label: 'Time In' },
                                { key: 'time_out', label: 'Time Out' },
                                { key: 'if_serviced', label: 'If Serviced' }
                            ]}
                            rows={rows}
                            noDataText={<RecordText>No recent data</RecordText> as any}
                            renderCell={(row, key) => {
                                if (key === 'name') return <RecordText>{row.name}</RecordText>
                                if (key === 'purpose_of_visit') return <RecordText>{row.purpose_of_visit}</RecordText>
                                if (key === 'date') return <RecordText>{row.date}</RecordText>
                                if (key === 'time_in') return <RecordText>{row.time_in}</RecordText>
                                if (key === 'time_out') {
                                    // if no time_out yet, show the time-out button
                                    if (!row.raw_time_out) {
                                        return (
                                            <ActionButton
                                                onClick={async () => {
                                                    if (!row.id) return
                                                    setUpdatingId(row.id)
                                                    try {
                                                        const now = new Date()
                                                        const res = await fetch(`${config.API_BASE}/sanctuary_records/${row.id}`, {
                                                            method: 'PUT',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ time_out: now.toISOString() })
                                                        })
                                                        if (!res.ok) {
                                                            const err = await res.json().catch(() => ({}))
                                                            console.error('Update sanctuary time_out error response:', err)
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
                                                className="sanctuary-timeout"
                                            >
                                                {updatingId === row.id ? 'Saving...' : 'time out'}
                                            </ActionButton>
                                        )
                                    }
                                    return <RecordText>{row.time_out}</RecordText>
                                }
                                if (key === 'if_serviced') {
                                    // render a small toggle button showing yes/no
                                    return (
                                        <div style={{ textAlign: 'center' }}>
                                            <ActionButton
                                                onClick={async () => {
                                                    if (!row.id) return
                                                    setUpdatingId(row.id)
                                                    try {
                                                        const res = await fetch(`${config.API_BASE}/sanctuary_records/${row.id}`, {
                                                            method: 'PUT',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ if_serviced: !row.if_serviced })
                                                        })
                                                        if (!res.ok) {
                                                            const err = await res.json().catch(() => ({}))
                                                            console.error('Update sanctuary if_serviced error response:', err)
                                                            alert('Failed to update serviced status: ' + (err.error || err.message || res.statusText))
                                                        } else {
                                                            await fetchRows()
                                                            try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                                        }
                                                    } catch (e) {
                                                        alert('Failed to update serviced status')
                                                    } finally {
                                                        setUpdatingId(null)
                                                    }
                                                }}
                                                className={`sanctuary-serviced ${row.if_serviced ? 'serviced-yes' : 'serviced-no'}`}
                                            >
                                                {row.if_serviced ? 'yes' : 'no'}
                                            </ActionButton>
                                        </div>
                                    )
                                }
                                return <RecordText>{row[key]}</RecordText>
                            }}
                        />
                    </div>
                </div>

                <div className="sanctuary-right">
                    <div className="heading-text recent-label">Enter Record</div>
                    <CardFrame className="client-form-card">
                            <div className="client-form-inner">

                            <label className="cf-label">Full name <span className="cf-required">*</span></label>
                            <div>
                                <SearchBar variant="form" inputClassName="cf-input" placeholder="Search clients" onSelect={(item) => setSelectedClient({ id: item.id, name: item.name })} />
                            </div>

                            <label className="cf-label">Purpose of Visit</label>
                            <input
                                className="cf-input"
                                type="text"
                                placeholder="Purpose of Visit"
                                value={purposeOfVisit}
                                onChange={(e) => setPurposeOfVisit(e.target.value)}
                            />

                            <div style={{ height: 8 }} />
                            <ActionButton
                                onClick={async () => {
                                    if (!selectedClient || !selectedClient.id) {
                                        alert('Please select a client from the search results')
                                        return
                                    }
                                    if (!purposeOfVisit) {
                                        alert('Please enter purpose of visit')
                                        return
                                    }

                                    setSubmitting(true)
                                    try {
                                        const now = new Date()
                                        const payload = {
                                            client_id: Number(selectedClient.id),
                                            purpose_of_visit: String(purposeOfVisit),
                                            time_in: now.toISOString(),
                                            date: now.toISOString().slice(0,10),
                                            if_serviced: false
                                        }
                                        const res = await fetch(`${config.API_BASE}/sanctuary_records`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        })
                                        if (!res.ok) {
                                            const err = await res.json().catch(() => ({}))
                                            console.error('Create sanctuary record error response:', err)
                                            alert('Failed to create record: ' + (err.error || err.message || res.statusText))
                                        } else {
                                            // refresh rows
                                            await fetchRows()
                                            // notify other components (totals, panels) to refresh
                                            try { window.dispatchEvent(new Event('dataUpdated')) } catch (e) {}
                                            // reset inputs
                                            setSelectedClient(null)
                                            setPurposeOfVisit('')
                                        }
                                    } catch (e) {
                                        alert('Failed to create record')
                                    } finally {
                                        setSubmitting(false)
                                    }
                                }}
                                className="cf-submit sanctuary-submit"
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

export default Sanctuary;

