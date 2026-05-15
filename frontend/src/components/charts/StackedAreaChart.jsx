import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { fmtNum, fmtChartDate } from '../../utils/formatters'

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316']

const RANGE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last 3 Months', value: '3m' },
  { label: 'This Year', value: 'this_year' },
]

function filterByRange(data, range, xKey) {
  if (range === 'all' || !data.length) return data
  const now = new Date()
  let cutoff
  if (range === '7d') cutoff = new Date(now.getTime() - 7 * 86400000)
  else if (range === '30d') cutoff = new Date(now.getTime() - 30 * 86400000)
  else if (range === 'this_month') cutoff = new Date(now.getFullYear(), now.getMonth(), 1)
  else if (range === '3m') cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  else if (range === 'this_year') cutoff = new Date(now.getFullYear(), 0, 1)
  else return data

  return data.filter(d => {
    const val = d[xKey]
    if (!val) return false
    const dt = new Date(val)
    return dt >= cutoff
  })
}

function getSmartTickConfig(dataLength, range) {
  if (range === '7d') return { interval: 0, formatter: fmtDayLabel }
  if (range === '30d' || range === 'this_month') return { interval: Math.max(0, Math.ceil(dataLength / 7) - 1), formatter: fmtChartDate }
  if (range === '3m') return { interval: Math.max(0, Math.ceil(dataLength / 10) - 1), formatter: fmtChartDate }
  if (dataLength <= 14) return { interval: Math.max(0, Math.floor(dataLength / 7)), formatter: fmtChartDate }
  return { interval: Math.max(0, Math.ceil(dataLength / 8) - 1), formatter: fmtMonthLabel }
}

function fmtDayLabel(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d)) return s
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[d.getDay()]} ${d.getDate()}`
}

function fmtMonthLabel(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

export default function StackedAreaChart({ data, areas, xKey = 'date', height = 300, zoomable = false }) {
  const { chartColors, isDark } = useTheme()
  const [chartRange, setChartRange] = useState('all')

  const filtered = useMemo(() => filterByRange(data, chartRange, xKey), [data, chartRange, xKey])
  const tickConfig = xKey === 'date' ? getSmartTickConfig(filtered.length, chartRange) : { interval: 0, formatter: undefined }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div className="rounded-lg p-3 shadow-xl border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
        <p className="text-sm font-medium mb-2" style={{ color: chartColors.tooltipText }}>
          {xKey === 'date' ? fmtChartDate(label) : label}
        </p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: chartColors.tooltipSec }}>{entry.name}:</span>
            <span className="font-medium" style={{ color: chartColors.tooltipText }}>{fmtNum(entry.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {zoomable && (
        <div className="flex gap-1.5 mb-3 justify-end flex-wrap">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setChartRange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                chartRange === opt.value
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  : isDark
                    ? 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    : 'bg-transparent text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={filtered} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis
            dataKey={xKey}
            stroke={chartColors.axis}
            fontSize={10}
            tickLine={false}
            tickFormatter={xKey === 'date' ? tickConfig.formatter : undefined}
            interval={tickConfig.interval}
            angle={-45}
            textAnchor="end"
            dy={10}
          />
          <YAxis stroke={chartColors.axis} fontSize={12} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} iconType="circle" />
          {areas.map((area, i) => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              name={area.name || area.key}
              stackId="1"
              stroke={area.color || COLORS[i % COLORS.length]}
              fill={area.color || COLORS[i % COLORS.length]}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
