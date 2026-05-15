import { useState, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { fmtMonth, fmtChartDate, fmtNum } from '../../utils/formatters'

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316']

function groupByQuarter(data, lineKeys) {
  const quarters = {}
  data.forEach(item => {
    const raw = item.month || item.date
    if (!raw) return
    const d = new Date(raw.length <= 7 ? raw + '-01' : raw)
    if (isNaN(d)) return
    const q = Math.ceil((d.getMonth() + 1) / 3)
    const yr = d.getFullYear().toString().slice(-2)
    const key = `Q${q} ${yr}`
    if (!quarters[key]) {
      quarters[key] = { period: key }
      lineKeys.forEach(k => { quarters[key][k] = 0 })
    }
    lineKeys.forEach(k => { quarters[key][k] += item[k] || 0 })
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
    const raw = item.month || item.date
    if (!raw) return false
    const d = new Date(raw.length <= 7 ? raw + '-01' : raw)
    return d.getFullYear() === yr && d.getMonth() >= startMonth && d.getMonth() < startMonth + 3
  })
}

export default function MultiLineChart({ data, lines, xKey = 'month', height = 300, onPointClick }) {
  const { chartColors, isDark } = useTheme()
  const isDate = xKey === 'date'
  const isMonth = xKey === 'month'
  const [viewMode, setViewMode] = useState('quarterly')
  const [drillQuarter, setDrillQuarter] = useState(null)

  const lineKeys = useMemo(() => lines.map(l => l.key), [lines])

  const chartData = useMemo(() => {
    if (!isMonth) return data
    if (drillQuarter) return getMonthsForQuarter(drillQuarter, data)
    if (viewMode === 'quarterly') return groupByQuarter(data, lineKeys)
    return data
  }, [data, isMonth, viewMode, drillQuarter, lineKeys])

  const activeXKey = isMonth && viewMode === 'quarterly' && !drillQuarter ? 'period' : xKey

  const tickFormatter = useCallback((val) => {
    if (isMonth && viewMode === 'quarterly' && !drillQuarter) return val
    if (isMonth) return fmtMonth(val)
    if (isDate) return fmtChartDate(val)
    return val
  }, [isMonth, isDate, viewMode, drillQuarter])

  const tickInterval = isDate
    ? (data.length > 30 ? Math.ceil(data.length / 10) - 1 : data.length > 14 ? 1 : 0)
    : 0

  const handleClick = (e) => {
    if (isMonth && viewMode === 'quarterly' && !drillQuarter && e?.activePayload?.[0]?.payload?.period) {
      setDrillQuarter(e.activePayload[0].payload.period)
      return
    }
    if (e?.activePayload && onPointClick) {
      onPointClick(e.activePayload[0]?.payload)
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div className="rounded-lg p-3 shadow-xl border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
        <p className="text-sm font-medium mb-2" style={{ color: chartColors.tooltipText }}>
          {isMonth && viewMode === 'quarterly' && !drillQuarter ? label : isMonth ? fmtMonth(label) : isDate ? fmtChartDate(label) : label}
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
                onClick={() => setDrillQuarter(null)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  isDark ? 'text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                         : 'text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                &larr; Back to Quarters
              </button>
            )}
            {drillQuarter && <span className="text-xs text-blue-400 font-medium">{drillQuarter}</span>}
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
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: isDate ? 50 : 10 }}
          onClick={handleClick}
          style={isMonth && viewMode === 'quarterly' && !drillQuarter ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis
            dataKey={activeXKey}
            stroke={chartColors.axis}
            fontSize={11}
            tickLine={false}
            tickFormatter={tickFormatter}
            interval={tickInterval}
            {...(isDate ? { angle: -45, textAnchor: 'end', height: 60, dy: 10 } : {})}
          />
          <YAxis stroke={chartColors.axis} fontSize={12} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ paddingTop: '15px', fontSize: '12px', lineHeight: '24px' }}
            iconSize={10}
            iconType="circle"
          />
          {lines.map((line, i) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name || line.key}
              stroke={line.color || COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: line.color || COLORS[i % COLORS.length] }}
              activeDot={{ r: 5, cursor: onPointClick || (isMonth && viewMode === 'quarterly') ? 'pointer' : 'default' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
