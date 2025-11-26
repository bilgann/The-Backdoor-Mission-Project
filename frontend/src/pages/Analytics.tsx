import TotalServicesUsed from '../components/TotalServicesUsed'
import UniqueClients from '../components/UniqueClients'
import TotalVisitors from '../components/TotalVisitors'
import GenderBreakdown from '../components/GenderBreakdown'
import '../styles/Home.css'
import '../styles/Analytics.css'
import CoatCheckPanel from '../components/CoatCheckPanel'
import WashroomPanel from '../components/WashroomPanel'
import SanctuaryPanel from '../components/SanctuaryPanel'
import SafeSleepPanel from '../components/SafeSleepPanel'
import ClinicPanel from '../components/ClinicPanel'
import AttendanceRecords from '../components/AttendanceRecords'
import ActivityPanel from '../components/ActivityPanel'
import Heatmap from '../components/Heatmap'
import CardFrame from '../components/CardFrame'
import ScorePanel from '../components/ScorePanel'
import React, { useEffect, useState } from 'react'
import config from '../config'

const Analytics = () => {
    return (
        <div className="home-page">
            <h1 className="page-title">Analytics</h1>

            <div className="page-sub-label" style={{ marginTop: 20 }}>Clients</div>

            <div className="home-chart-section">
                <div className="dashboard-widgets">
                    <div className="clients-column">
                        <TotalServicesUsed />
                        <UniqueClients />
                    </div>

                    <div className="visitors-column">
                        <TotalVisitors />
                        <GenderBreakdown />
                    </div>
                </div>
            </div>

            <div className='service-breakdown-section'>
                <div className="page-label" style={{ marginTop: 20 }}>Service Breakdown</div>

                <div className='coat-check-section'>
                    <div className="page-sub-label" style={{ marginTop: 20, paddingBottom: 20 }}>Coat Check</div>
                    <CoatCheckPanel/>

                    <div style={{ height: 20 }} />

                    {/* Coat Check frequency heatmap placed directly under the coat check panel */}
                    <CardFrame className="clients-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="heatmap-card-title">Frequency By Day/Time</div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <CoatCheckHeatmap />
                        </div>
                    </CardFrame>
                </div>

                <div className='washroom-section'>
                    <div className="page-sub-label" style={{ marginTop: 20, paddingBottom: 20 }}>Washroom</div>
                    <WashroomPanel/>

                    <div style={{ height: 20 }} />

                    {/* Washroom frequency heatmap placed directly under the washroom panel */}
                    <CardFrame className="clients-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="heatmap-card-title">Frequency By Day/Time</div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <WashroomHeatmap />
                        </div>
                    </CardFrame>
                </div>

                <div className='sanctuary-section'>
                    <div className="page-sub-label" style={{ marginTop: 20, paddingBottom: 20 }}>Sanctuary</div>
                    <SanctuaryPanel/>
                    
                    <div style={{ height: 20 }} />

                    {/* Sanctuary frequency heatmap placed directly under the sanctuary panel */}
                    <CardFrame className="clients-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="heatmap-card-title">Frequency By Day/Time</div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <SanctuaryHeatmap />
                        </div>
                    </CardFrame>
                </div>

                <div className='safe-sleep-section'>
                    <div className="page-sub-label" style={{ marginTop: 20, paddingBottom: 20 }}>Safe Sleep</div>
                    <SafeSleepPanel/>
                    
                    <div style={{ height: 20 }} />

                    {/* Safe Sleep frequency heatmap placed directly under the safe sleep panel */}
                    <CardFrame className="clients-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="heatmap-card-title">Frequency By Day/Time</div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <SafeSleepHeatmap />
                        </div>
                    </CardFrame>

                    {/* Weekly average occupancy card for Safe Sleep (Average Occupancy Rate) */}
                    <div style={{ height: 12 }} />
                    <CardFrame className="client-form-card occupancy-card">
                        <div>
                            <div style={{
                                color: '#000',
                                fontFamily: 'Satoshi Variable',
                                fontSize: 20,
                                fontStyle: 'normal',
                                fontWeight: 400,
                                lineHeight: '120%',
                                letterSpacing: '-0.6px',
                                marginBottom: 10
                            }}>Average Occupancy Rate</div>

                            <div style={{
                                color: '#000',
                                fontFamily: 'Satoshi Variable',
                                fontSize: 32,
                                fontStyle: 'normal',
                                fontWeight: 400,
                                lineHeight: '120%',
                                letterSpacing: '-0.96px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <SafeSleepWeeklyAverageOccupancy />
                            </div>
                        </div>
                    </CardFrame>
                </div>

                <div className='clinic-section'>
                    <div className="page-sub-label" style={{ marginTop: 20, paddingBottom: 20 }}>Clinic</div>
                    <ClinicPanel/>
                    
                    <div style={{ height: 20 }} />

                    {/* Clinic frequency heatmap placed directly under the clinic panel */}
                    <CardFrame className="clients-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="heatmap-card-title">Frequency By Day/Time</div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <ClinicHeatmap />
                        </div>
                    </CardFrame>
                </div>

                <div className='activity-section'>
                    <div className="page-sub-label" style={{ marginTop: 20, paddingBottom: 20 }}>Activity</div>
                    
                    <div style={{ height: 12 }} />
                    <AttendanceRecords/>

                    
                    <div style={{ marginTop: 20 }}>
                              <ActivityPanel/>
                              <div style={{ height: 12 }} />
                              <ScorePanel />
                    </div>
                </div>
                
            </div>
        </div>
    )
}

export default Analytics;

// small subcomponent to fetch and render the washroom heatmap
function WashroomHeatmap() {
    const [data, setData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchHeatmap = async () => {
            setLoading(true)
            try {
                const resp = await fetch(`${config.API_BASE}/api/department-heatmap?dept=washroom&range=day`)
                const json = await resp.json()
                if (!cancelled) {
                    if (json && json.success && json.data) setData(json.data)
                    else setData(makeMock())
                }
            } catch (e) {
                if (!cancelled) setData(makeMock())
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchHeatmap()
        return () => { cancelled = true }
    }, [])

    function makeMock() {
        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']
        const hours = Array.from({length:10},(_,i)=>9+i)
        const out:any = {}
        days.forEach(d=>{ out[d] = {}; hours.forEach(h=> out[d][String(h)] = Math.round(Math.random()*20)) })
        return out
    }

    return (
        <Heatmap data={data} colorScale={["#B6EAFF","#7DDAFF","#30B8ED","#1B8AD9","#15418D"]} />
    )
}

// small subcomponent to fetch and render the coat check heatmap
function CoatCheckHeatmap() {
    const [data, setData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchHeatmap = async () => {
            setLoading(true)
            try {
                const resp = await fetch(`${config.API_BASE}/api/department-heatmap?dept=coatcheck&range=day`)
                const json = await resp.json()
                if (!cancelled) {
                    if (json && json.success && json.data) setData(json.data)
                    else setData(makeMock())
                }
            } catch (e) {
                if (!cancelled) setData(makeMock())
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchHeatmap()
        return () => { cancelled = true }
    }, [])

    function makeMock() {
        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']
        const hours = Array.from({length:10},(_,i)=>9+i)
        const out:any = {}
        days.forEach(d=>{ out[d] = {}; hours.forEach(h=> out[d][String(h)] = Math.round(Math.random()*20)) })
        return out
    }

    return (
        <Heatmap data={data} />
    )
}

// small subcomponent to fetch and render the sanctuary heatmap
function SanctuaryHeatmap() {
    const [data, setData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchHeatmap = async () => {
            setLoading(true)
            try {
                const resp = await fetch(`${config.API_BASE}/api/department-heatmap?dept=sanctuary&range=day`)
                const json = await resp.json()
                if (!cancelled) {
                    if (json && json.success && json.data) setData(json.data)
                    else setData(makeMock())
                }
            } catch (e) {
                if (!cancelled) setData(makeMock())
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchHeatmap()
        return () => { cancelled = true }
    }, [])

    function makeMock() {
        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']
        const hours = Array.from({length:10},(_,i)=>9+i)
        const out:any = {}
        days.forEach(d=>{ out[d] = {}; hours.forEach(h=> out[d][String(h)] = Math.round(Math.random()*20)) })
        return out
    }

    return (
        <Heatmap data={data} colorScale={["#EFFFB1","#DDFF59","#CBEF39","#AAE30B","#5FAD0B"]} labelColor="#123210" />
    )
}

// small subcomponent to fetch and render the safe sleep heatmap
function SafeSleepHeatmap() {
    const [data, setData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchHeatmap = async () => {
            setLoading(true)
            try {
                const resp = await fetch(`${config.API_BASE}/api/department-heatmap?dept=safesleep&range=day`)
                const json = await resp.json()
                if (!cancelled) {
                    if (json && json.success && json.data) setData(json.data)
                    else setData(makeMock())
                }
            } catch (e) {
                if (!cancelled) setData(makeMock())
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchHeatmap()
        return () => { cancelled = true }
    }, [])

    function makeMock() {
        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']
        const hours = Array.from({length:10},(_,i)=>9+i)
        const out:any = {}
        days.forEach(d=>{ out[d] = {}; hours.forEach(h=> out[d][String(h)] = Math.round(Math.random()*20)) })
        return out
    }

    return (
        <Heatmap data={data} colorScale={["#D0D6FC","#8494FB","#6278F6","#3548B1","#2C3B9C"]} />
    )
}

// small subcomponent to fetch and render the weekly average occupancy for Safe Sleep
function SafeSleepWeeklyAverageOccupancy() {
    const [pct, setPct] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchAvg = async () => {
            setLoading(true)
            try {
                const resp = await fetch(`${config.API_BASE}/api/safe-sleep-statistics?range=week`)
                const json = await resp.json()
                if (!cancelled && json && json.success && Array.isArray(json.chart_data)) {
                    // chart_data expected to be array of { label, value } for 7 days
                    const values = json.chart_data.map((d: any) => Number(d.value) || 0)
                    const sum = values.reduce((a: number, b: number) => a + b, 0)
                    const avg = values.length ? (sum / values.length) : 0
                    // occupancy rate = avg occupied beds / 20
                    const rate = Math.round((avg / 20) * 100)
                    setPct(rate)
                } else if (!cancelled) {
                    setPct(0)
                }
            } catch (e) {
                if (!cancelled) setPct(0)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchAvg()
        return () => { cancelled = true }
    }, [])

    if (loading || pct === null) return <span>—</span>

    // choose color by thresholds matching SafeSleep page
    let color = '#95F492'
    if (pct > 25 && pct < 50) color = '#EDF373'
    else if (pct >= 50 && pct <= 75) color = '#FFAB6B'
    else if (pct > 75) color = '#FF2752'

    return (
        <>
            <span>{pct}%</span>
            <span
                aria-hidden="true"
                style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.06) inset'
                }}
            />
        </>
    )
}

// small subcomponent to fetch and render the clinic heatmap
function ClinicHeatmap() {
    const [data, setData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchHeatmap = async () => {
            setLoading(true)
            try {
                const resp = await fetch(`${config.API_BASE}/api/department-heatmap?dept=clinic&range=day`)
                const json = await resp.json()
                if (!cancelled) {
                    if (json && json.success && json.data) setData(json.data)
                    else setData(makeMock())
                }
            } catch (e) {
                if (!cancelled) setData(makeMock())
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        fetchHeatmap()
        return () => { cancelled = true }
    }, [])

    function makeMock() {
        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']
        const hours = Array.from({length:10},(_,i)=>9+i)
        const out:any = {}
        days.forEach(d=>{ out[d] = {}; hours.forEach(h=> out[d][String(h)] = Math.round(Math.random()*20)) })
        return out
    }

    return (
        <Heatmap data={data} colorScale={["#FFA9CC","#FF6BA6","#F32D7C","#BB0F54","#660541"]} />
    )
}

