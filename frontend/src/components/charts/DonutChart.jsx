import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { fmtNum } from '../../utils/formatters'

const renderLabel = ({ name, percent }) => {
  if (percent < 0.05) return null
  return `${(percent * 100).toFixed(0)}%`
}

export default function DonutChart({ data, nameKey = 'employee', dataKey = 'connections', height = 300, onSliceClick, selectedEmployee }) {
  const { chartColors } = useTheme()
  const filtered = data.filter(d => d[dataKey] > 0)

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
      <div className="rounded-lg p-3 shadow-xl border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
        <p className="text-sm font-medium" style={{ color: chartColors.tooltipText }}>{d.name}</p>
        <p className="text-xs" style={{ color: chartColors.tooltipSec }}>Value: <span className="font-medium" style={{ color: chartColors.tooltipText }}>{fmtNum(d.value)}</span></p>
      </div>
    )
  }

  const handleClick = (entry) => {
    if (onSliceClick && entry?.[nameKey]) {
      onSliceClick(entry[nameKey])
    }
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey={dataKey}
          nameKey={nameKey}
          label={renderLabel}
          labelLine={false}
          onClick={handleClick}
          cursor={onSliceClick ? 'pointer' : 'default'}
        >
          {filtered.map((entry, i) => {
            const isSelected = selectedEmployee && entry[nameKey] === selectedEmployee
            return (
              <Cell
                key={i}
                fill={entry.color || '#3B82F6'}
                opacity={selectedEmployee && !isSelected ? 0.3 : 1}
                outerRadius={isSelected ? 110 : undefined}
              />
            )
          })}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: chartColors.axis }}
          iconType="circle"
          formatter={(value) => <span style={{ color: chartColors.tooltipSec }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
