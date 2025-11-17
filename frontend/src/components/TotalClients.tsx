/**
 * TotalClients Component
 * 
 * This is a reusable component that displays client statistics with:
 * - Total client count
 * - Time range selector (Day/Week/Month/Year)
 * - Interactive line chart showing client trends
 * - Service breakdown by type
 * 
 * The component connects to the backend API to fetch real-time data
 * and automatically refreshes to show the latest statistics.
 */

import { useState, useEffect, useCallback } from 'react'
import TimeRangeSlider from './TimeRangeSlider'
import Chart from './Chart'
import '../styles/TotalClients.css'
import config from '../config'

// Service colors matching the sidebar data entry colors
const SERVICE_COLORS: { [key: string]: string } = {
    'Coat Check': '#FE2323',
    'Washroom': '#6ECAEE',
    'Sanctuary': '#D9F373',
    'Clinic': '#FA488F',
    'Safe Sleep': '#2C3B9C'
}

interface ChartDataPoint {
    label: string
    value: number
}

interface ServiceBreakdown {
    'Coat Check': number
    'Washroom': number
    'Sanctuary': number
    'Clinic': number
    'Safe Sleep': number
}

interface StatisticsData {
    total_clients: number
    service_breakdown: ServiceBreakdown
    chart_data: ChartDataPoint[]
}

const TotalClients = () => {
    // State to track the selected time range (day, week, month, year)
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day')
    
    // State to store the statistics data from the API
    const [data, setData] = useState<StatisticsData | null>(null)
    
    // State to track loading and error states
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    /**
     * Function to fetch client statistics from the backend API
     * This function is called whenever the time range changes or on component mount
     * useCallback ensures the function reference stays stable unless timeRange changes
     */
    const fetchStatistics = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            
            // Make API call to backend with the selected time range
            const response = await fetch(`${config.API_BASE}/api/client-statistics?range=${timeRange}`)
            // If server returned non-2xx, gather text for debugging
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                setError(`Server ${response.status}: ${text || response.statusText}`);
                return;
            }

            // parse JSON; guard against invalid JSON
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
    }, [timeRange]) // Recreate function when timeRange changes

    /**
     * useEffect hook to fetch data when component mounts or time range changes
     * Also sets up automatic refresh every 30 seconds for real-time updates
     */
    useEffect(() => {
        // Fetch data immediately
        fetchStatistics()
        
        // Set up interval to refresh data every 30 seconds for real-time updates
        const interval = setInterval(() => {
            fetchStatistics()
        }, 30000) // 30 seconds
        
        // Cleanup: clear interval when component unmounts or time range changes
        return () => clearInterval(interval)
    }, [fetchStatistics]) // Re-run when fetchStatistics changes (which happens when timeRange changes)

    /**
     * Handle time range selection change
     * When user clicks D/W/M/Y, update the state which triggers a new API call
     */
    const handleTimeRangeChange = (range: 'day' | 'week' | 'month' | 'year') => {
        setTimeRange(range)
    }

    /**
     * Format today's date for display
     */
    const getTodayDate = () => {
        const today = new Date()
        const options: Intl.DateTimeFormatOptions = { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        }
        return today.toLocaleDateString('en-US', options)
    }

    // Show loading state
    if (loading && !data) {
        return (
            <div className="total-clients-container">
                <div className="loading-message">Loading statistics...</div>
            </div>
        )
    }

    // Show error state
    if (error && !data) {
        return (
            <div className="total-clients-container">
                <div className="error-message">{error}</div>
            </div>
        )
    }

    // If no data, show empty state
    if (!data) {
        return null
    }

    return (
        <div className="total-clients-container">
            {/* Title and Total Count Section */}
            <div className="total-clients-header">
                <h2 className="total-clients-title">Total Clients</h2>
                <div className="total-clients-number-container">
                    <div className="total-clients-number">{data.total_clients}</div>
                </div>
                <span className="total-clients-date">{getTodayDate()}</span>
            </div>

            {/* Time Range Selector */}
            <TimeRangeSlider 
                selectedRange={timeRange}
                onRangeChange={handleTimeRangeChange}
            />

            {/* Line Chart Section */}
            <Chart data={data.chart_data} height={140} />

            {/* Service Breakdown Section */}
            <div className="service-breakdown">
                {Object.entries(data.service_breakdown).map(([service, count]) => (
                    <div key={service} className="service-item">
                        <div 
                            className="service-color-indicator" 
                            style={{ backgroundColor: SERVICE_COLORS[service] }}
                        ></div>
                        <span className="service-name">{service}</span>
                        <span className="service-count">{count}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default TotalClients

