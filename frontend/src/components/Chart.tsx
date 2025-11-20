/**
 * Chart Component
 * 
 * A reusable line chart component for displaying time-series data.
 * Uses recharts library for rendering.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import '../styles/Chart.css'

interface ChartDataPoint {
    label: string
    value: number
}

interface ChartProps {
    data: ChartDataPoint[]
    height?: number | string
    lineColor?: string
}

const Chart = ({ data, height = 140, lineColor = '#95F492' }: ChartProps) => {
    // compute Y max from data so 0 anchors at the bottom
    const values = (data || []).map(d => (typeof d.value === 'number' ? d.value : Number(d.value || 0)))
    const dataMax = values.length ? Math.max(...values) : 0
    const yMax = Math.max(1, dataMax) // ensure non-zero range

    return (
        <div className="chart-container">
            {/* height can be a number (px) or string (e.g. '100%') */}
            <ResponsiveContainer width="100%" height={height as any}>
                <LineChart 
                    data={data}
                    margin={{ top: 5, right: 0, left: -15, bottom: 5 }}
                >
                    {/* Grid lines for better readability */}
                    <CartesianGrid strokeDasharray="3 3" stroke="#B5B5B5" />
                    
                    {/* X-axis: shows time labels (hours, days, months) */}
                    <XAxis 
                        dataKey="label" 
                        stroke="#B5B5B5"
                        tick={{ fill: '#B5B5B5', fontSize: 10, fontFamily: '"Satoshi Variable", sans-serif' }}
                        style={{
                            fontSize: '10px',
                            fontFamily: '"Satoshi Variable", sans-serif',
                            fill: '#B5B5B5'
                        }}
                    />
                    
                    {/* Y-axis: shows client count */}
                    <YAxis 
                        stroke="#B5B5B5"
                        tick={{ fill: '#B5B5B5', fontSize: 10, fontFamily: '"Satoshi Variable", sans-serif' }}
                        style={{
                            fontSize: '10px',
                            fontFamily: '"Satoshi Variable", sans-serif',
                            fill: '#B5B5B5'
                        }}
                        domain={[0, yMax]}
                    />
                    <Tooltip formatter={(value: any) => [value, 'Count']} />
                    
                    {/* Line: the actual data visualization */}
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={lineColor} 
                        className="chart-line"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: 'none', strokeWidth: 0, fill: lineColor }}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        connectNulls={true}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export default Chart

