import React, { useEffect, useState } from "react";
import "../styles/GetClients.css";
import "../styles/Clients.css";
import config from "../config";
import SearchBar from "../components/SearchBar";
import RecordText from "../components/RecordText";
import ResponsiveTable from "../components/ResponsiveTable";
import ClientsTotalPanel from "../components/ClientsTotalPanel";
import ClientInfo from "../components/ClientInfo";
import ClientForm from '../components/ClientForm';

// Clients page left column implementation.
// This file focuses on assembling reusable components created earlier:
// - `HeadingText` for section titles
// - `SearchBar` for client search with dropdown
// - `ActionButton` for CTA buttons (Add Client, Show Info)
// - `RecordText` for table row typography
// Comments are provided to help learning and future edits.

const Clients: React.FC = () => {
    const [recent, setRecent] = useState<Array<any>>([]);
    const [selectedClient, setSelectedClient] = useState<null | { id: string | number; name: string }>(null);

    useEffect(() => {
        // Fetch a small recent clients list for display in the left column table.
        // Backend endpoint: GET /api/clients/recent
        // If your backend differs, update the path or implement an endpoint that returns
        // an array of client records: { id, name, date, service }
        const parseToTs = (d: any) => {
            try {
                if (!d) return 0
                if (typeof d === 'number') return d
                if (typeof d === 'string') {
                    let s = d.trim()
                    if (s.includes('T')) return new Date(s).getTime()
                    if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:?\d{0,2}/.test(s)) {
                        s = s.replace(/\s+/, 'T')
                        return new Date(s).getTime() || 0
                    }
                    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).getTime() || 0
                    return new Date(s).getTime() || 0
                }
                return new Date(d).getTime() || 0
            } catch (e) {
                return 0
            }
        }

        const sortRecentData = (arr: any[]) => {
            if (!Array.isArray(arr)) return []
            const copy = [...arr]
            copy.sort((a: any, b: any) => {
                const ta = parseToTs(a.date)
                const tb = parseToTs(b.date)
                const byDate = tb - ta
                if (byDate !== 0) return byDate
                const ida = Number(a.id || 0)
                const idb = Number(b.id || 0)
                return idb - ida
            })
            return copy
        }

        const fetchRecent = () => {
            fetch(`${config.API_BASE}/api/clients/recent`)
                .then((r) => r.json())
                .then((data) => setRecent(sortRecentData(data || [])))
                .catch(() => setRecent([]));
        }

        fetchRecent()
        const interval = setInterval(fetchRecent, 30000) // refresh every 30s
        return () => clearInterval(interval)
    }, []);

    // Service color map used for recent table indicator
    const SERVICE_COLORS: { [key: string]: string } = {
        'Coat Check': '#FE2323',
        'Washroom': '#6ECAEE',
        'Sanctuary': '#D9F373',
        'Clinic': '#FA488F',
        'Safe Sleep': '#2C3B9C',
        'Activity': '#F07D0B'
    }

    return (
        <div className="clients-page">
            <h1 className="page-title">Clients</h1>

            <div className="number-of-clients-graph">
                <ClientsTotalPanel/>
            </div>

            <div className="clients-row">
                <div className="clients-left">
                    <div style={{ marginTop: 16 }} className="search-block">
                        <div className="heading-text recent-label">Search Clients</div>
                            <div style={{ marginTop: 8 }}>
                            <SearchBar onSelect={(item) => setSelectedClient({ id: item.id, name: item.name })} />
                        </div>



                        
                    </div>
                    
                    <div className="heading-text recent-label" style={{ marginTop: 30 }}>Client Info</div>
                        <div className="client-info-block" style={{ marginTop: 15 }}>
                        <ClientInfo clientId={selectedClient?.id ? String(selectedClient.id) : undefined} clientName={selectedClient?.name} />
                    </div>

                    <div className="heading-text recent-label" style={{ marginTop: 20 }}>Recent Clients</div>

                    <div className="recent-table-wrapper">
                        <ResponsiveTable
                            columns={[
                                { key: 'name', label: 'Name' },
                                { key: 'date', label: 'Date' },
                                { key: 'service', label: 'Service' },
                            ]}
                            rows={recent}
                            noDataText={<RecordText>No recent clients</RecordText> as any}
                            renderCell={(row, key) => {
                                if (key === 'service') {
                                    const color = SERVICE_COLORS[row.service] || '#cccccc'
                                    return (
                                        <div className="service-cell">
                                            <span className="service-color" style={{ background: color }} />
                                            <RecordText>{row.service}</RecordText>
                                        </div>
                                    )
                                }

                                if (key === 'date') {
                                    // For Safe Sleep service, show date-only in the recent clients table
                                    if (row.service === 'Safe Sleep') {
                                        try {
                                            const d = row.date ? new Date(row.date) : null
                                            if (d && !isNaN(d.getTime())) {
                                                return <RecordText>{d.toLocaleDateString('en-US')}</RecordText>
                                            }
                                        } catch (e) {}
                                    }
                                    return <RecordText>{row.date}</RecordText>
                                }

                                return <RecordText>{row[key]}</RecordText>
                            }}
                        />
                    </div>
                </div>

                <div className="clients-right">
                    <div className="add-client-block">
                        <div className="heading-text recent-label">Create Client</div>
                        <div style={{ marginTop: 12 }}>
                            <ClientForm onSuccess={() => {
                                // refresh recent clients list and sort newest-first
                                fetch(`${config.API_BASE}/api/clients/recent`)
                                .then(r => r.json())
                                .then(d => {
                                    try {
                                        const parseToTs = (d: any) => {
                                            try {
                                                if (!d) return 0
                                                if (typeof d === 'number') return d
                                                if (typeof d === 'string') {
                                                    let s = d.trim()
                                                    if (s.includes('T')) return new Date(s).getTime()
                                                    if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:?\d{0,2}/.test(s)) {
                                                        s = s.replace(/\s+/, 'T')
                                                        return new Date(s).getTime() || 0
                                                    }
                                                    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).getTime() || 0
                                                    return new Date(s).getTime() || 0
                                                }
                                                return new Date(d).getTime() || 0
                                            } catch (e) {
                                                return 0
                                            }
                                        }

                                        const copy = Array.isArray(d) ? [...d] : []
                                        copy.sort((a: any, b: any) => {
                                            const ta = parseToTs(a.date)
                                            const tb = parseToTs(b.date)
                                            const byDate = tb - ta
                                            if (byDate !== 0) return byDate
                                            const ida = Number(a.id || 0)
                                            const idb = Number(b.id || 0)
                                            return idb - ida
                                        })
                                        setRecent(copy)
                                    } catch (e) {
                                        setRecent(d || [])
                                    }
                                })
                                .catch(() => {});
                            }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Clients;

