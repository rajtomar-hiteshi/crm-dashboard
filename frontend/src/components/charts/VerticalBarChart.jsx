import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { fmtNum } from '../../utils/formatters'

export default function VerticalBarChart({ data, bars, xKey = 'employee', height = 300, colored = false, onBarClick, selectedEmployee }) {
  const { chartColors } = useTheme()

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div className="rounded-lg p-3 shadow-xl border" style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}>
        <p className="text-sm font-medium mb-2" style={{ color: chartColors.tooltipText }}>{label}</p>
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

  const handleClick = (entry) => {
    if (onBarClick && entry?.[xKey]) onBarClick(entry[xKey])
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
        <XAxis dataKey={xKey} stroke={chartColors.axis} fontSize={12} tickLine={false} />
        <YAxis stroke={chartColors.axis} fontSize={12} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {bars.length > 1 && (
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ paddingTop: '15px', fontSize: '12px', lineHeight: '24px' }}
            iconSize={10}
            iconType="circle"
          />
        )}
        {bars.map((bar) => (
          <Bar key={bar.key} dataKey={bar.key} name={bar.name || bar.key} fill={bar.color || '#3B82F6'} radius={[4, 4, 0, 0]} barSize={bar.barSize} onClick={handleClick} cursor={onBarClick ? 'pointer' : 'default'}>
            {colored && data.map((entry, j) => (
              <Cell
                key={j}
                fill={entry.color || bar.color || '#3B82F6'}
                opacity={selectedEmployee && entry.employee !== selectedEmployee ? 0.3 : 1}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
