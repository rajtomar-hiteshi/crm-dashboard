import { useState, useRef, useEffect } from 'react'
import { RefreshCw, RotateCcw, ChevronDown, Sun, Moon, Monitor, X, LogOut, Calendar, Users } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useFilters } from '../context/FilterContext'
import { useAuth } from '../context/AuthContext'
import { useEmployees } from '../hooks/useApi'

const DATE_PRESETS = [
  { label: 'All Time', value: 'all', period: null },
  { label: 'Today', value: 'today', period: 'today' },
  { label: 'Yesterday', value: 'yesterday', period: 'yesterday' },
  { label: 'This Week', value: 'this_week', period: 'this_week' },
  { label: 'Last Week', value: 'last_week', period: 'last_week' },
  { label: 'This Month', value: 'this_month', period: 'this_month' },
  { label: 'Last Month', value: 'last_month', period: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter', period: 'this_quarter' },
  { label: 'Last Quarter', value: 'last_quarter', period: 'last_quarter' },
  { label: 'This Year', value: 'this_year', period: 'this_year' },
  { label: 'Last Year', value: 'last_year', period: 'last_year' },
  { label: 'Custom Range', value: 'custom', period: null },
]

function PillSelect({ value, label, options, onChange, onClear, isDark, icon: Icon }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isActive = value !== 'all'

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayLabel = options.find(o => o.value === value)?.label || label

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all border ${
          isActive
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
            : isDark
              ? 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:border-[#475569]'
              : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
        }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="max-w-[140px] truncate">{displayLabel}</span>
        {isActive && onClear ? (
          <X
            className="w-3.5 h-3.5 hover:text-blue-400 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onClear() }}
          />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-1 min-w-[180px] max-h-[320px] overflow-y-auto rounded-xl shadow-xl border z-50 py-1 ${
            isDark ? 'bg-[#1E293B] border-[#334155]' : 'bg-white border-[#E2E8F0]'
          }`}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                opt.value === value
                  ? 'bg-blue-500/10 text-blue-500 font-medium'
                  : isDark
                    ? 'text-[#F1F5F9] hover:bg-[#334155]'
                    : 'text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Header({ title, subtitle, onSync, syncing }) {
  const { mode, isDark, cycleTheme } = useTheme()
  const { user, logout } = useAuth()
  const {
    employee, datePreset, period,
    setEmployee, setDateRange, setDatePreset, setPeriod, resetFilters,
  } = useFilters()
  const { data: employees = [] } = useEmployees()
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const handlePresetChange = (value) => {
    setDatePreset(value)
    if (value === 'custom') {
      setPeriod(null)
      return
    }
    const preset = DATE_PRESETS.find(p => p.value === value)
    if (preset) {
      if (preset.period) {
        setPeriod(preset.period)
        setDateRange({ startDate: null, endDate: null })
      } else {
        setPeriod(null)
        setDateRange({ startDate: null, endDate: null })
      }
    }
  }

  const handleCustomApply = () => {
    setPeriod(null)
    setDateRange({ startDate: customStart || null, endDate: customEnd || null })
  }

  const handleEmployeeChange = (value) => {
    setEmployee(value)
  }

  const activeFilterCount = [
    employee !== 'all',
    datePreset !== 'all',
  ].filter(Boolean).length

  const themeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor

  const iconBtnClass = `p-2.5 rounded-full transition-colors border ${
    isDark
      ? 'bg-[#1E293B] border-[#334155] hover:bg-[#334155] text-[#94A3B8]'
      : 'bg-white border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#64748B]'
  }`

  const dateInputClass = `text-sm rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 border transition-colors ${
    isDark
      ? 'bg-[#1E293B] border-[#334155] text-[#F1F5F9]'
      : 'bg-white border-[#E2E8F0] text-[#0F172A]'
  }`

  const empOptions = [
    { label: 'All Employees', value: 'all' },
    ...employees.map(emp => ({ label: emp.full_name || emp.name, value: String(emp.id) })),
  ]

  return (
    <header className={`border-b flex-shrink-0 sticky top-0 z-30 ${isDark ? 'bg-[#0F172A] border-[#334155]' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="min-w-0">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{title}</h2>
          <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PillSelect
            value={employee}
            label="All Employees"
            options={empOptions}
            onChange={handleEmployeeChange}
            onClear={() => setEmployee('all')}
            isDark={isDark}
            icon={Users}
          />

          <PillSelect
            value={datePreset}
            label="All Time"
            options={DATE_PRESETS}
            onChange={handlePresetChange}
            onClear={() => handlePresetChange('all')}
            isDark={isDark}
            icon={Calendar}
          />

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={dateInputClass} />
              <span className={`text-xs ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={dateInputClass} />
              <button onClick={handleCustomApply} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-xs font-medium text-white transition-colors">
                Apply
              </button>
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 bg-red-500/5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All
            </button>
          )}

          <div className={`w-px h-8 ${isDark ? 'bg-[#334155]' : 'bg-[#E2E8F0]'}`} />

          <button onClick={cycleTheme} className={iconBtnClass} title={`Theme: ${mode}`}>
            {(() => { const Icon = themeIcon; return <Icon className="w-4 h-4" /> })()}
          </button>

          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full text-sm font-medium text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>

          {user && (
            <div className={`flex items-center gap-2 pl-3 border-l ${isDark ? 'border-[#334155]' : 'border-[#E2E8F0]'}`}>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className={`text-sm font-medium hidden xl:inline ${isDark ? 'text-[#F1F5F9]' : 'text-[#0F172A]'}`}>
                {user.full_name}
              </span>
              <button
                onClick={logout}
                className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#334155] text-[#94A3B8]' : 'hover:bg-[#F1F5F9] text-[#64748B]'}`}
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
