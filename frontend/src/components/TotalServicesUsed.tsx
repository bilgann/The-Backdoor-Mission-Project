import { useState, useEffect, useCallback } from 'react'
import TimeRangeSlider from './TimeRangeSlider'
import Chart from './Chart'
import '../styles/TotalClients.css'
import config from '../config'

interface ChartDataPoint {
    label: string
    value: number
}

interface StatisticsData {
    total_clients?: number
    total_visitors?: number
    service_breakdown?: { [key: string]: number }
    chart_data: ChartDataPoint[]
}

const TotalServicesUsed = () => {
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day')
    const [data, setData] = useState<StatisticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStatistics = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await fetch(`${config.API_BASE}/api/client-statistics?range=${timeRange}`)
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                setError(`Server ${response.status}: ${text || response.statusText}`);
                return;
            }
            let result: any = null;
            try {
                result = await response.json();
            } catch (e) {
                const text = await response.text().catch(() => '');
                setError(`Invalid JSON from server${text ? `: ${text}` : ''}`);
                return;
            }
            if (result && result.success) {
                setData(result)
            } else {
                setError((result && result.message) || 'Failed to fetch statistics')
            }
        } catch (err) {
            setError('Error connecting to server')
            console.error('Error fetching statistics:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange])

    useEffect(() => {
        fetchStatistics()
        const interval = setInterval(() => {
            fetchStatistics()
        }, 30000)
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

    const getTodayDate = () => {
        const today = new Date()
        const options: Intl.DateTimeFormatOptions = { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        }
        return today.toLocaleDateString('en-US', options)
    }

    if (loading && !data) {
        return (
            <div className="total-clients-container">
                <div className="loading-message">Loading statistics...</div>
            </div>
        )
    }

    if (error && !data) {
        return (
            <div className="total-clients-container">
                <div className="error-message">{error}</div>
            </div>
        )
    }

    if (!data) return null

    return (
        <div className="total-clients-container">
            <div className="total-clients-header">
                <h2 className="total-clients-title">Total Services Used</h2>
                <div className="total-clients-number-container">
                        <div className="total-clients-number">
                            {typeof data.total_visitors === 'number'
                                ? data.total_visitors
                                : (data.service_breakdown
                                    ? Object.values(data.service_breakdown).reduce((s, v) => s + (v || 0), 0)
                                    : (data.total_clients ?? 0))}
                        </div>
                </div>
                <span className="total-clients-date">{getTodayDate()}</span>
            </div>

            <TimeRangeSlider 
                selectedRange={timeRange}
                onRangeChange={handleTimeRangeChange}
            />

            <div className="total-clients-chart-fill">
                <Chart data={data.chart_data} height="100%" />
            </div>
        </div>
    )
}

export default TotalServicesUsed
