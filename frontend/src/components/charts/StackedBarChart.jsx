import { useState, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { fmtNum, fmtMonth, fmtChartDate } from '../../utils/formatters'

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316']

function groupByQuarter(data) {
  const quarters = {}
  data.forEach(item => {
    const d = new Date(item.month + '-01')
    if (isNaN(d)) return
    const q = Math.ceil((d.getMonth() + 1) / 3)
    const yr = d.getFullYear().toString().slice(-2)
    const key = `Q${q} ${yr}`
    if (!quarters[key]) quarters[key] = { period: key, _months: [], connections: 0, follow_ups: 0, inmails: 0, leads: 0 }
    quarters[key].connections += item.connections || 0
    quarters[key].follow_ups += item.follow_ups || 0
    quarters[key].inmails += item.inmails || 0
    quarters[key].leads += item.leads || 0
    quarters[key]._months.push(item.month)
  })
  return Object.values(quarters)
}

function getMonthsForQuarter(quarterLabel, allData) {
  const match = quarterLabel.match(/Q(\d)\s+(\d{2})/)
  if (!match) return allData
  const q = parseInt(match[1])
  const yr = 2000 + parseInt(match[2])
  const startMonth = (q - 1) * 3
  return allData.filter(item => {
    const d = new Date(item.month + '-01')
    return d.getFullYear() === yr && d.getMonth() >= startMonth && d.getMonth() < startMonth + 3
  })
}

export default function StackedBarChart({ data, bars, xKey = 'date', height = 300 }) {
  const { chartColors, isDark } = useTheme()
  const isMonth = xKey === 'month'
  const [viewMode, setViewMode] = useState('quarterly')
  const [drillQuarter, setDrillQuarter] = useState(null)

  const chartData = useMemo(() => {
    if (!isMonth) return data
    if (drillQuarter) return getMonthsForQuarter(drillQuarter, data)
    if (viewMode === 'quarterly') return groupByQuarter(data)
    return data
  }, [data, isMonth, viewMode, drillQuarter])

  const dataKey = (drillQuarter || viewMode === 'monthly') ? xKey : 'period'
  const isDate = xKey === 'date'

  const tickFormatter = useCallback((val) => {
    if (drillQuarter || viewMode === 'monthly') return fmtMonth(val)
    return val
  }, [drillQuarter, viewMode])

  const handleBarClick = useCallback((entry) => {
    if (isMonth && viewMode === 'quarterly' && !drillQuarter && entry?.period) {
      setDrillQuarter(entry.period)
    }
  }, [isMonth, viewMode, drillQuarter])

  const handleBack = useCallback(() => {
    setDrillQuarter(null)
  }, [])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div className="rounded-lg p-3 shadow-xl border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
        <p className="text-sm font-medium mb-2" style={{ color: chartColors.tooltipText }}>
          {isMonth && !drillQuarter && viewMode === 'quarterly' ? label : isMonth ? fmtMonth(label) : isDate ? fmtChartDate(label) : label}
        </p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: chartColors.tooltipSec }}>{entry.name}:</span>
            <span className="font-medium" style={{ color: chartColors.tooltipText }}>{fmtNum(entry.value)}</span>
          </div>
        ))}
        {isMonth && viewMode === 'quarterly' && !drillQuarter && (
          <p className="text-[10px] mt-1.5 pt-1.5 border-t" style={{ color: chartColors.tooltipSec, borderColor: chartColors.tooltipBorder }}>Click to expand</p>
        )}
      </div>
    )
  }

  return (
    <div>
      {isMonth && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {drillQuarter && (
              <button
                onClick={handleBack}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  isDark ? 'text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                         : 'text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                &larr; Back to Quarters
              </button>
            )}
            {drillQuarter && (
              <span className="text-xs text-blue-400 font-medium">{drillQuarter}</span>
            )}
          </div>
          {!drillQuarter && (
            <div className="flex gap-1">
              {['quarterly', 'monthly'].map(mode => (
                <button
                  key={mode}
                  onClick={() => { setViewMode(mode); setDrillQuarter(null) }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    viewMode === mode
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      : isDark
                        ? 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                        : 'bg-transparent text-gray-500 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {mode === 'quarterly' ? 'Quarterly' : 'Monthly'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: isDate ? 50 : 10 }}
          onClick={(e) => e?.activePayload?.[0]?.payload && handleBarClick(e.activePayload[0].payload)}
          style={isMonth && viewMode === 'quarterly' && !drillQuarter ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis
            dataKey={drillQuarter || viewMode === 'monthly' ? xKey : isMonth ? 'period' : xKey}
            stroke={chartColors.axis}
            fontSize={11}
            tickLine={false}
            tickFormatter={isMonth ? tickFormatter : isDate ? fmtChartDate : undefined}
            interval={0}
            {...(isDate ? { angle: -45, textAnchor: 'end', dy: 10 } : {})}
          />
          <YAxis stroke={chartColors.axis} fontSize={12} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} iconType="circle" />
          {bars.map((bar, i) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name || bar.key}
              stackId="a"
              fill={bar.color || COLORS[i % COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
