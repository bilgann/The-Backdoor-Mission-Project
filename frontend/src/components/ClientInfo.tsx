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

            // Fetch base client info
            const resp = await fetch(`${config.API_BASE}/client/${id}`);
            const data = await resp.json();

            // Compute current month start/end for attendance query
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const startISO = monthStart.toISOString().slice(0, 10);
            const endISO = monthEnd.toISOString().slice(0, 10);

            // Fetch client activity attendance records for the month
            const actResp = await fetch(`${config.API_BASE}/client_activity?client_id=${encodeURIComponent(id)}&start_date=${startISO}&end_date=${endISO}`);
            const actJson = await actResp.json();
            const activityRecords = Array.isArray(actJson) ? actJson : [];

            // Calculate attendance count (number of attendance records in the month)
            const attendanceCount = activityRecords.length;

            // Build weekly totals (week starting Monday)
            const weekTotals: Record<string, number> = {};
            const getWeekStartISO = (isoDateStr: string) => {
                const d = new Date(isoDateStr);
                // normalize to local date (strip time)
                const day = d.getDay(); // 0 = Sun, 1 = Mon ...
                const diff = (day + 6) % 7; // days since Monday
                const monday = new Date(d);
                monday.setDate(d.getDate() - diff);
                monday.setHours(0, 0, 0, 0);
                return monday.toISOString().slice(0, 10);
            };

            for (const r of activityRecords) {
                // r.date may be datetime string
                const dateStr = r.date || r.date_iso || r.client_date || null;
                if (!dateStr) continue;
                const weekKey = getWeekStartISO(dateStr);
                weekTotals[weekKey] = (weekTotals[weekKey] || 0) + 1;
            }

            // Sort week keys chronologically
            const sortedWeeks = Object.keys(weekTotals).sort((a, b) => a.localeCompare(b));

            // Compute percent change between consecutive weeks, then average them
            const pctChanges: number[] = [];
            for (let i = 1; i < sortedWeeks.length; i++) {
                const prev = weekTotals[sortedWeeks[i - 1]] || 0;
                const curr = weekTotals[sortedWeeks[i]] || 0;
                let change = 0;
                if (prev === 0) {
                    change = curr === 0 ? 0 : 100; // treat 0->x as 100% increase for visualization
                } else {
                    change = ((curr - prev) / prev) * 100;
                }
                pctChanges.push(change);
            }

            const avgPct = pctChanges.length > 0 ? (pctChanges.reduce((s, v) => s + v, 0) / pctChanges.length) : 0;
            const formattedDelta = sortedWeeks.length < 2 ? '—' : `${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(2)} %`;

            if (data) {
                setClientData({
                    clientId: String(data.client_id || id),
                    clientName: data.full_name || "",
                    nickname: data.nickname ?? null,
                    birth_year: data.birth_year ?? null,
                    gender: data.gender || "",
                    attendance_count: attendanceCount,
                    attendance_delta: formattedDelta,
                });
            }
        } catch (e) {
            console.error(e);
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
            // if we have a clientId, fetch fuller client details (attendance)
            if (clientId) {
                fetchClientInfo(clientId);
            }
        }
    }, [clientId, clientName, gender, fetchClientInfo]);

    const DeltaPill: React.FC<{ delta?: string }> = ({ delta }) => {
        const text = delta ?? "+4.08 %";
        if (text === '—') {
            return <div className="ci-delta neutral">{text}</div>;
        }
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