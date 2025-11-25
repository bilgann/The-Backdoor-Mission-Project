import React, { useEffect, useState } from 'react'
import CardFrame from './CardFrame'
import '../styles/GenderBreakdown.css'
import config from '../config'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

type GenderCounts = {
  female: number
  male: number
  nonbinary: number
}

const FEMALE_COLOR = '#FFBAF1'
const MALE_COLOR = '#BAE0FF'
const NB_COLOR = '#BAFFD0'

function normalizeGender(g: any): 'female' | 'male' | 'nonbinary' | null {
  if (!g) return null
  const s = String(g).trim().toLowerCase()
  if (s === 'f' || s === 'female' || s === 'woman' || s === 'female ' || s === 'fema') return 'female'
  if (s === 'm' || s === 'male' || s === 'man') return 'male'
  if (s === 'nb' || s === 'non-binary' || s === 'nonbinary' || s === 'non binary') return 'nonbinary'
  // fallback heuristics
  if (s.indexOf('female') !== -1) return 'female'
  if (s.indexOf('male') !== -1) return 'male'
  if (s.indexOf('non') !== -1 && s.indexOf('bin') !== -1) return 'nonbinary'
  return null
}

const GenderBreakdown: React.FC = () => {
  const [counts, setCounts] = useState<GenderCounts>({ female: 0, male: 0, nonbinary: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchClients() {
      try {
        setLoading(true)
        setError(null)
        const resp = await fetch(`${config.API_BASE}/api/clients`)
        if (!resp.ok) throw new Error(`status ${resp.status}`)
        const data = await resp.json()
        const c = { female: 0, male: 0, nonbinary: 0 }
        for (const item of (data || [])) {
          const g = normalizeGender(item.gender)
          if (g === 'female') c.female++
          else if (g === 'male') c.male++
          else if (g === 'nonbinary') c.nonbinary++
        }
        if (!cancelled) setCounts(c)
      } catch (err) {
        console.error('[GenderBreakdown] fetch error', err)
        if (!cancelled) setError('Failed to load genders')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchClients()
    const onUpdate = () => fetchClients()
    window.addEventListener('dataUpdated', onUpdate)
    return () => { cancelled = true; window.removeEventListener('dataUpdated', onUpdate) }
  }, [])

  const pieData = [
    { name: 'Female', value: counts.female, color: FEMALE_COLOR },
    { name: 'Male', value: counts.male, color: MALE_COLOR },
    { name: 'Non-Binary', value: counts.nonbinary, color: NB_COLOR }
  ]

  return (
    <CardFrame className="gender-breakdown-frame">
      <div className="header-number-group">
        <div className="total-visitors-header">
          <h3 className="total-visitors-title">Gender Breakdown</h3>
        </div>
      </div>

      <div className="gender-breakdown-inner">
        <div className="gender-left">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={80}
                outerRadius={120}
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
              >
                {pieData.map((d, idx) => (
                  <Cell key={idx} fill={d.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${value}`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="gender-right">
          {loading ? (
            <div className="gender-loading">Loading...</div>
          ) : error ? (
            <div className="gender-error">{error}</div>
          ) : (
            <div className="gender-list">
              {pieData.map((d) => (
                <div key={d.name} className="gender-row">
                  <div className="gender-left-label">
                    <div className="gender-swatch" style={{ background: d.color }} />
                    <div className="gender-name">{d.name}</div>
                  </div>
                  <div className="gender-value">{d.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CardFrame>
  )
}

export default GenderBreakdown
