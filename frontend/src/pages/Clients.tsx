import React, { useEffect, useState } from "react";
import "../styles/GetClients.css";
import "../styles/Clients.css";
import config from "../config";
import SearchBar from "../components/SearchBar";
import ActionButton from "../components/ActionButton";
import RecordText from "../components/RecordText";
import ResponsiveTable from "../components/ResponsiveTable";
import ClientsTotalPanel from '../components/ClientsTotalPanel';
import ClientInfo from "../components/ClientInfo";

// Clients page left column implementation.
// This file focuses on assembling reusable components created earlier:
// - `HeadingText` for section titles
// - `SearchBar` for client search with dropdown
// - `ActionButton` for CTA buttons (Add Client, Show Info)
// - `RecordText` for table row typography
// Comments are provided to help learning and future edits.

const Clients: React.FC = () => {
    const [recent, setRecent] = useState<Array<any>>([]);
    const [selectedClient, setSelectedClient] = useState<null | { id: string | number; name: string; dob?: string }>(null);

    useEffect(() => {
        // Fetch a small recent clients list for display in the left column table.
        // Backend endpoint: GET /api/clients/recent
        // If your backend differs, update the path or implement an endpoint that returns
        // an array of client records: { id, name, dob, date, service }
        const fetchRecent = () => {
            fetch(`${config.API_BASE}/api/clients/recent`)
                .then((r) => r.json())
                .then((data) => setRecent(data || []))
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
        'Activity': '#A8A8A8'
    }

    return (
        <div className="clients-page">
            <h1 className="page-title">Clients</h1>

            <div className="number-of-clients-graph">
                <ClientsTotalPanel />
            </div>

            <div className="clients-row">
                <div className="clients-left">
                    <ActionButton to="/clients/add" className="get-clients-button client-cta">
                        get excel file
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M0.5 11.5L11.5 0.5M11.5 0.5H0.5M11.5 0.5V11.5" stroke="black" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </ActionButton>

                    <div style={{ marginTop: 16 }} className="search-block">
                        <div className="heading-text recent-label">Search Clients</div>
                        <div style={{ marginTop: 8 }}>
                            <SearchBar onSelect={(item) => setSelectedClient({ id: item.id, name: item.name, dob: item.dob })} />
                        </div>

                        <div className="buttons-row">
                            <div>
                                <ActionButton to="/clients/add" className="get-clients-button client-cta">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M5.70833 0.75V10.6667M0.75 5.70833H10.6667" stroke="#2B4118" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    add client
                                </ActionButton>
                            </div>
                        </div>

                        
                    </div>
                    
                    <div className="heading-text recent-label" style={{ marginTop: 30 }}>Client Info</div>
                    <div className="client-info-block" style={{ marginTop: 15 }}>
                        <ClientInfo clientId={selectedClient?.id ? String(selectedClient.id) : undefined} clientName={selectedClient?.name} dob={selectedClient?.dob} />
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
                                return <RecordText>{row[key]}</RecordText>
                            }}
                        />
                    </div>
                </div>

                <div className="clients-right">
                    <div className="add-client-block">
                        <div className="heading-text recent-label">Create Client</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Clients;

