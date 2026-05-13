import { useState, useRef, useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'

export default function KPICard({ title, value, subtitle, icon: Icon, color, change, details, onDetailClick }) {
  const [showPopover, setShowPopover] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!showPopover) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShowPopover(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPopover])

  const handleDetailClick = (name, e) => {
    e.stopPropagation()
    setShowPopover(false)
    if (onDetailClick) onDetailClick(name)
  }

  return (
    <div
      ref={ref}
      className={`bg-surface-card border border-edge rounded-xl p-5 relative overflow-visible ${details?.length ? 'cursor-pointer' : ''}`}
      onClick={() => details?.length && setShowPopover(!showPopover)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {change !== undefined && change !== null && (
          <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
            <ArrowUpRight className="w-3 h-3" />
            {change}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-content mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-sm font-medium text-content-muted">{title}</p>
      {subtitle && <p className="text-xs text-content-faint mt-0.5">{subtitle}</p>}

      {showPopover && details && details.length > 0 && (
        <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-surface-card border border-edge rounded-xl p-3 shadow-xl">
          <p className="text-xs font-semibold text-content-muted mb-2 uppercase tracking-wider">Top Performers</p>
          {details.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
              onClick={(e) => handleDetailClick(d.name, e)}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color || color }} />
                <span className="text-sm text-content">{d.name}</span>
              </div>
              <span className="text-sm font-semibold text-content">{typeof d.value === 'number' ? d.value.toLocaleString() : d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
