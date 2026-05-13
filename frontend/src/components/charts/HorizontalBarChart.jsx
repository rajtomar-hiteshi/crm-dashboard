import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { fmtNum } from '../../utils/formatters'

export default function HorizontalBarChart({ data, dataKey, height = 300, onBarClick, selectedEmployee }) {
  const { chartColors } = useTheme()

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
      <div className="rounded-lg p-3 shadow-xl border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
        <p className="text-sm font-medium" style={{ color: chartColors.tooltipText }}>{d.payload.employee || d.payload.location}</p>
        <p className="text-xs" style={{ color: chartColors.tooltipSec }}>{d.name}: <span className="font-medium" style={{ color: chartColors.tooltipText }}>{fmtNum(d.value)}</span></p>
      </div>
    )
  }

  const handleClick = (entry) => {
    if (onBarClick && entry?.employee) onBarClick(entry.employee)
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} horizontal={false} />
        <XAxis type="number" stroke={chartColors.axis} fontSize={12} tickLine={false} />
        <YAxis type="category" dataKey="employee" stroke={chartColors.axis} fontSize={12} tickLine={false} width={75} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} barSize={24} onClick={handleClick} cursor={onBarClick ? 'pointer' : 'default'}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.color || '#3B82F6'}
              opacity={selectedEmployee && entry.employee !== selectedEmployee ? 0.3 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
