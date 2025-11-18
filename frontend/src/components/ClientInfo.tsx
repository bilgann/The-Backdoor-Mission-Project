import React, { useState, useEffect, useCallback } from "react";
import config from "../config";
import CardFrame from "./CardFrame";
import "../styles/ClientInfo.css";

interface ClientInfoProps {
    clientId?: string;
    clientName?: string;
    gender?: string;
}

type ClientData = {
    clientId?: string;
    clientName?: string;
    gender?: string;
    attendance_count?: number;
    attendance_delta?: string;
} | null;

const ClientInfo: React.FC<ClientInfoProps> = ({ clientId, clientName, gender }) => {
    const [clientData, setClientData] = useState<ClientData>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchClientInfo = useCallback(async (id: string) => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${config.API_BASE}/client/${id}`);
            const data = await response.json();
            if (data) {
                setClientData({
                    clientId: String(data.client_id || id),
                    clientName: data.full_name || "",
                    gender: data.gender || "",
                    attendance_count: data.attendance_count ?? undefined,
                    attendance_delta: data.attendance_delta ?? undefined,
                });
            }
        } catch (e) {
            setError("Failed to load client information");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // show parent-provided details immediately
        if (clientId || clientName) {
            setClientData({ clientId, clientName, gender });
            setLoading(false);
        }
        // If we have a clientId, fetch full details unless the parent already supplied gender
        // so fetch to ensure gender is present.
        if (clientId && !gender) {
            fetchClientInfo(clientId);
        }
    }, [clientId, clientName, gender, fetchClientInfo]);

    const DeltaPill: React.FC<{ delta?: string }> = ({ delta }) => {
        const text = delta ?? "+4.08 %";
        const isNegative = typeof text === 'string' && text.trim().startsWith('-');
        const cls = isNegative ? 'ci-delta negative' : 'ci-delta positive';
        return <div className={cls}>{text}</div>;
    };

    return (
        <CardFrame className="client-info-card">
            
            <div className="client-info">
                {loading ? (
                    <div className="loading-message">Loading client...</div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <>
                        <div className="ci-rows">
                            <div className="ci-row">
                                <span className="ci-label">Full Name:</span>
                                <span className="ci-value">{clientData?.clientName || '—'}</span>
                            </div>

                            <div className="ci-row">
                                <span className="ci-label">Client ID:</span>
                                <span className="ci-value">{clientData?.clientId || '—'}</span>
                            </div>

                            {/* Date of birth removed from schema; not displayed */}

                            <div className="ci-row">
                                <span className="ci-label">Gender:</span>
                                <span className="ci-value">{clientData?.gender || '—'}</span>
                            </div>
                        </div>

                        <div className="ci-activities">
                            <div className="activities-label">Activities Attended This Month</div>

                            <div className="ci-attendance-row">
                                <div className="ci-attendance">{clientData?.attendance_count ?? '—'}</div>
                                <DeltaPill delta={clientData?.attendance_delta} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </CardFrame>
    );
};

export default ClientInfo;