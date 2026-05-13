import { useState } from 'react'
import { RefreshCw, RotateCcw, ChevronDown, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const DATE_PRESETS = [
  { label: 'All Time', value: 'all', start: null, end: null },
  { label: 'Jan 2026', value: '2026-01', start: '2026-01-01', end: '2026-01-31' },
  { label: 'Feb 2026', value: '2026-02', start: '2026-02-01', end: '2026-02-28' },
  { label: 'Mar 2026', value: '2026-03', start: '2026-03-01', end: '2026-03-31' },
  { label: 'Apr 2026', value: '2026-04', start: '2026-04-01', end: '2026-04-30' },
  { label: 'May 2026', value: '2026-05', start: '2026-05-01', end: '2026-05-31' },
  { label: 'Q1 2026 (Jan-Mar)', value: 'q1', start: '2026-01-01', end: '2026-03-31' },
  { label: 'Q2 2026 (Apr-Jun)', value: 'q2', start: '2026-04-01', end: '2026-06-30' },
  { label: 'Custom Range', value: 'custom', start: null, end: null },
]

export default function Header({
  title, subtitle, employee, startDate, endDate, employees,
  onEmployeeChange, onDateChange, onReset, onSync, syncing,
}) {
  const { mode, isDark, cycleTheme } = useTheme()
  const [datePreset, setDatePreset] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const handlePresetChange = (value) => {
    setDatePreset(value)
    if (value === 'custom') return
    const preset = DATE_PRESETS.find(p => p.value === value)
    if (preset) {
      onDateChange({ startDate: preset.start, endDate: preset.end })
    }
  }

  const handleCustomApply = () => {
    onDateChange({
      startDate: customStart || null,
      endDate: customEnd || null,
    })
  }

  const themeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor

  const optionStyle = {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    color: isDark ? '#F1F5F9' : '#0F172A',
  }

  const selectClass = `appearance-none text-sm rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer border ${
    isDark
      ? 'bg-[#1E293B] border-[#334155] text-[#F1F5F9]'
      : 'bg-white border-[#E2E8F0] text-[#0F172A]'
  }`

  const dateInputClass = `text-sm rounded-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 border ${
    isDark
      ? 'bg-[#1E293B] border-[#334155] text-[#F1F5F9]'
      : 'bg-white border-[#E2E8F0] text-[#0F172A]'
  }`

  const iconBtnClass = `p-2.5 rounded-full transition-colors border ${
    isDark
      ? 'bg-[#1E293B] border-[#334155] hover:bg-[#334155] text-[#94A3B8]'
      : 'bg-white border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#64748B]'
  }`

  return (
    <header className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${
      isDark ? 'bg-[#0F172A] border-[#334155]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
    }`}>
      <div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{title}</h2>
        <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{subtitle} &middot; 2026</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <select value={employee} onChange={(e) => onEmployeeChange(e.target.value)} className={selectClass}>
            <option value="all" style={optionStyle}>All Employees</option>
            {employees.map(emp => (
              <option key={emp.name} value={emp.name} style={optionStyle}>{emp.name}</option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`} />
        </div>

        <div className="relative">
          <select value={datePreset} onChange={(e) => handlePresetChange(e.target.value)} className={selectClass}>
            {DATE_PRESETS.map(p => (
              <option key={p.value} value={p.value} style={optionStyle}>{p.label}</option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`} />
        </div>

        {datePreset === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={dateInputClass} />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={dateInputClass} />
            <button onClick={handleCustomApply} className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-medium text-white">
              Apply
            </button>
          </>
        )}

        <button onClick={cycleTheme} className={iconBtnClass} title={`Theme: ${mode}`}>
          {(() => { const Icon = themeIcon; return <Icon className="w-4 h-4" /> })()}
        </button>

        <button onClick={onReset} className={iconBtnClass} title="Reset filters">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full text-sm font-medium text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Refresh Data'}
        </button>
      </div>
    </header>
  )
}
