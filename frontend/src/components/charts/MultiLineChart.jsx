import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { fmtMonth, fmtNum } from '../../utils/formatters'

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316']

export default function MultiLineChart({ data, lines, xKey = 'month', height = 300, onPointClick }) {
  const { chartColors } = useTheme()

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div className="rounded-lg p-3 shadow-xl border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
        <p className="text-sm font-medium mb-2" style={{ color: chartColors.tooltipText }}>
          {xKey === 'month' ? fmtMonth(label) : label}
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

  const handleClick = (e) => {
    if (e?.activePayload && onPointClick) {
      onPointClick(e.activePayload[0]?.payload)
    }
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} onClick={handleClick}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
        <XAxis dataKey={xKey} stroke={chartColors.axis} fontSize={12} tickLine={false} tickFormatter={xKey === 'month' ? fmtMonth : undefined} />
        <YAxis stroke={chartColors.axis} fontSize={12} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} iconType="circle" />
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name || line.key}
            stroke={line.color || COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, fill: line.color || COLORS[i % COLORS.length] }}
            activeDot={{ r: 5, cursor: onPointClick ? 'pointer' : 'default' }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
