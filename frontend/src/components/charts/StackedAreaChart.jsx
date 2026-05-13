import { useState, useCallback } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Brush,
} from 'recharts'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { fmtNum, fmtChartDate } from '../../utils/formatters'

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316']

export default function StackedAreaChart({ data, areas, xKey = 'date', height = 300, zoomable = false }) {
  const { chartColors } = useTheme()
  const [brushStart, setBrushStart] = useState(0)
  const [brushEnd, setBrushEnd] = useState(data.length - 1)

  const handleBrushChange = useCallback((e) => {
    if (e) {
      setBrushStart(e.startIndex)
      setBrushEnd(e.endIndex)
    }
  }, [])

  const zoomIn = () => {
    const range = brushEnd - brushStart
    if (range <= 5) return
    const mid = Math.floor((brushStart + brushEnd) / 2)
    const half = Math.max(Math.floor(range / 4), 2)
    setBrushStart(Math.max(0, mid - half))
    setBrushEnd(Math.min(data.length - 1, mid + half))
  }

  const zoomOut = () => {
    const range = brushEnd - brushStart
    const mid = Math.floor((brushStart + brushEnd) / 2)
    const half = Math.min(range, data.length)
    setBrushStart(Math.max(0, mid - half))
    setBrushEnd(Math.min(data.length - 1, mid + half))
  }

  const resetZoom = () => {
    setBrushStart(0)
    setBrushEnd(data.length - 1)
  }

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
        <div className="flex gap-1 mb-2 justify-end">
          <button onClick={zoomIn} className="p-1.5 bg-surface-card border border-edge rounded-lg hover:bg-surface-hover transition-colors" title="Zoom In">
            <ZoomIn className="w-4 h-4 text-content-muted" />
          </button>
          <button onClick={zoomOut} className="p-1.5 bg-surface-card border border-edge rounded-lg hover:bg-surface-hover transition-colors" title="Zoom Out">
            <ZoomOut className="w-4 h-4 text-content-muted" />
          </button>
          <button onClick={resetZoom} className="p-1.5 bg-surface-card border border-edge rounded-lg hover:bg-surface-hover transition-colors" title="Reset Zoom">
            <Maximize2 className="w-4 h-4 text-content-muted" />
          </button>
        </div>
      )}
      <ResponsiveContainer width="100%" height={zoomable ? height + 40 : height}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: zoomable ? 30 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis dataKey={xKey} stroke={chartColors.axis} fontSize={11} tickLine={false} tickFormatter={xKey === 'date' ? fmtChartDate : undefined} />
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
          {zoomable && data.length > 10 && (
            <Brush
              dataKey={xKey}
              height={24}
              stroke={chartColors.brushStroke}
              fill={chartColors.brushFill}
              startIndex={brushStart}
              endIndex={brushEnd}
              onChange={handleBrushChange}
              tickFormatter={xKey === 'date' ? fmtChartDate : undefined}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
