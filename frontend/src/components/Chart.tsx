/**
 * Chart Component
 * 
 * A reusable line chart component for displaying time-series data.
 * Uses recharts library for rendering.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import '../styles/Chart.css'

interface ChartDataPoint {
    label: string
    value: number
}

interface ChartProps {
    data: ChartDataPoint[]
    height?: number
}

const Chart = ({ data, height = 140 }: ChartProps) => {
    return (
        <div className="chart-container">
            <ResponsiveContainer width="100%" height={height}>
                <LineChart 
                    data={data}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
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
                    />
                    
                    {/* Line: the actual data visualization */}
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#95F492" 
                        strokeWidth={2}
                        dot={false}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export default Chart

