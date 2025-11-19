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
    nickname?: string | null;
    birth_year?: number | null;
    attendance_count?: number;
    attendance_delta?: string;
} | null;

const ClientInfo: React.FC<ClientInfoProps> = ({ clientId, clientName, gender }) => {
    const [clientData, setClientData] = useState<ClientData>(null);
    // default to not loading; show "Choose a client" when nothing selected
    const [loading, setLoading] = useState<boolean>(false);
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
                    nickname: data.nickname ?? null,
                    birth_year: data.birth_year ?? null,
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
        // If no client is selected, reset to idle state so UI shows "Choose a client"
        if (!clientId && !clientName) {
            setClientData(null)
            setLoading(false)
            return
        }

        // show parent-provided details immediately
        if (clientId || clientName) {
            setClientData({ clientId, clientName, gender });
            // if we have a clientId and need more details, fetch them
            if (clientId && !gender) {
                fetchClientInfo(clientId);
            }
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
                ) : !clientData ? (
                    <div className="loading-message">Choose a client</div>
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

                            <div className="ci-row">
                                <span className="ci-label">Preferred Name:</span>
                                <span className="ci-value">{clientData?.nickname ?? '—'}</span>
                            </div>

                            <div className="ci-row">
                                <span className="ci-label">Birth Year:</span>
                                <span className="ci-value">{clientData?.birth_year ?? '—'}</span>
                            </div>

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