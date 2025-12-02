import { useState, useEffect, useCallback } from 'react'
import TimeRangeSlider from './TimeRangeSlider'
import Chart from './Chart'
import '../styles/UniqueClients.css'
import config from '../config'

interface ChartDataPoint {
    label: string
    value: number
}

interface StatisticsData {
    total_unique_clients?: number
    chart_data?: ChartDataPoint[]
}

const UniqueClients = () => {
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day')
    const [data, setData] = useState<StatisticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [fallbackTotalRecords, setFallbackTotalRecords] = useState<number | null>(null)

    const fetchStatistics = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            // Call the server stats endpoint first
            const resp = await fetch(`${config.API_BASE}/api/client-statistics?range=${timeRange}`)
            if (!resp.ok) {
                setError('Failed to load unique client statistics')
                setLoading(false)
                return
            }
            const result = await resp.json()
            console.debug('UniqueClients: /api/client-statistics result:', result)

            // If backend returned a number of distinct clients, use it
            if (result && result.success && typeof result.total_clients === 'number') {
                // prefer server-provided unique-client chart (chart_unique); fall back to chart_data
                setData({ total_unique_clients: result.total_clients, chart_data: result.chart_unique || result.chart_data || [] })
                setLoading(false)
                return
            }

            // Otherwise compute a fallback by fetching per-service endpoints
            const computeFallback = async () => {
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

                const rangeToDates = (range: string) => {
                    const end = new Date(today)
                    let start = new Date(today)
                    if (range === 'day') {
                        start = new Date(today)
                    } else if (range === 'week') {
                        const day = today.getDay() // 0 Sun..6 Sat
                        const diff = (day + 6) % 7 // make Monday = 0
                        start = new Date(today)
                        start.setDate(today.getDate() - diff)
                    } else if (range === 'month') {
                        start = new Date(today.getFullYear(), today.getMonth(), 1)
                    } else if (range === 'year') {
                        start = new Date(today.getFullYear(), 0, 1)
                    }
                    // end should include entire day -> set to 23:59:59
                    end.setHours(23,59,59,999)
                    start.setHours(0,0,0,0)
                    return { start, end }
                }

                const { start, end } = rangeToDates(timeRange)

                const endpoints = [
                    '/coat_check_records',
                    '/washroom_records',
                    '/sanctuary_records',
                    '/clinic_records',
                    '/safe_sleep_records',
                    '/client_activity'
                ]

                const fetches = await Promise.all(endpoints.map(ep => fetch(`${config.API_BASE}${ep}`)
                    .then(r => r.ok ? r.json() : [])
                    .catch(() => [])))

                let totalRecords = 0
                const clientSet = new Set<string>()
                const perEndpointCounts: { [key: string]: number } = {}

                function parseISODateToLocal(dstr: string){
                    if(!dstr) return new Date(dstr)
                    try{
                        if(/^\d{4}-\d{2}-\d{2}$/.test(dstr)){
                            const parts = dstr.split('-').map(p=>Number(p))
                            return new Date(parts[0], parts[1]-1, parts[2])
                        }
                        const m = dstr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/)
                        if(m){
                            const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3])
                            const hh = Number(m[4]), mm = Number(m[5]), ss = Number(m[6])
                            return new Date(y, mo-1, da, hh, mm, ss)
                        }
                    }catch(e){/* fallback */}
                    return new Date(dstr)
                }

                const parseDate = (rec: any) => {
                    if (!rec) return null
                    if (rec.time_in) return parseISODateToLocal(rec.time_in)
                    if (rec.date) return parseISODateToLocal(rec.date)
                    if (rec.created_at) return parseISODateToLocal(rec.created_at)
                    return null
                }

                for (let i = 0; i < fetches.length; i++) {
                    const list = fetches[i]
                    const ep = endpoints[i]
                    let epCount = 0
                    if (!Array.isArray(list)) continue
                    for (const r of list) {
                        const d = parseDate(r)
                        if (d && d >= start && d <= end) {
                            totalRecords += 1
                            epCount += 1
                            // robust client id extraction
                            const cid = r.client_id ?? r.clientId ?? (r.client && (r.client.client_id ?? r.client.id)) ?? r.client ?? null
                            if (cid !== undefined && cid !== null) {
                                try {
                                    clientSet.add(String(cid))
                                } catch (e) {
                                    clientSet.add(JSON.stringify(cid))
                                }
                            }
                        }
                    }
                    perEndpointCounts[ep] = epCount
                }

                console.debug('UniqueClients perEndpointCounts:', perEndpointCounts)

                setData({ total_unique_clients: clientSet.size, chart_data: [] })
                setFallbackTotalRecords(totalRecords)
                console.debug('UniqueClients fallback: totalRecords=', totalRecords, 'uniqueClients=', clientSet.size)
                setLoading(false)
            }

            await computeFallback()
        } catch (err) {
            console.error(err)
            setError('Error connecting to server')
            setLoading(false)
        }
    }, [timeRange])

    useEffect(() => {
        fetchStatistics()
        const interval = setInterval(fetchStatistics, 30000)
        return () => clearInterval(interval)
    }, [fetchStatistics])

    useEffect(() => {
        const onData = () => fetchStatistics()
        window.addEventListener('dataUpdated', onData)
        return () => window.removeEventListener('dataUpdated', onData)
    }, [fetchStatistics])

    const handleTimeRangeChange = (range: 'day' | 'week' | 'month' | 'year') => {
        setTimeRange(range)
    }

    const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    if (loading && !data) {
        return (
            <div className="unique-clients-container">
                <div className="loading-message">Loading unique clients...</div>
            </div>
        )
    }

    if (error && !data) {
        return (
            <div className="unique-clients-container">
                <div className="error-message">{error}</div>
            </div>
        )
    }

    return (
        <div className="unique-clients-container">
            <div className="total-clients-header">
                <h2 className="total-clients-title">Unique Clients</h2>
                <div className="total-clients-number-container">
                    <div className="total-clients-number">{data?.total_unique_clients ?? 0}</div>
                </div>
                <span className="total-clients-date">{todayLabel}</span>
            </div>

            <TimeRangeSlider selectedRange={timeRange} onRangeChange={handleTimeRangeChange} />

            <div className="total-clients-chart-fill">
                <Chart data={data?.chart_data || []} height={"100%"} lineColor="#FE87B1" />
            </div>

            {/* Debug info: fallback computed totals (placed after chart so it doesn't change header->slider spacing) */}
            <div style={{ color: '#666', fontSize: 12 }}>
                {fallbackTotalRecords !== null ? (
                    <div>Fallback records: {fallbackTotalRecords} • Fallback unique: {data?.total_unique_clients ?? 0}</div>
                ) : null}
            </div>
        </div>
    )
}

export default UniqueClients
