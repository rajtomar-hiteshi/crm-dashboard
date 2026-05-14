import { useState } from 'react'
import { RefreshCw, RotateCcw, ChevronDown, Sun, Moon, Monitor, Filter, Shield, User, LogOut } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useFilters } from '../context/FilterContext'
import { useAuth } from '../context/AuthContext'
import { useEmployees } from '../hooks/useApi'

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

const CHANNELS = [
  { label: 'All Channels', value: 'all' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Email', value: 'email' },
  { label: 'InMail', value: 'inmail' },
]

const STATUSES = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
]

export default function Header({ title, subtitle, onSync, syncing }) {
  const { mode, isDark, cycleTheme } = useTheme()
  const { user, logout } = useAuth()
  const {
    employee, datePreset, channel, status,
    setEmployee, setDateRange, setDatePreset, setChannel, setStatus, resetFilters,
  } = useFilters()
  const { data: employees = [] } = useEmployees()
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewRole, setViewRole] = useState('admin')

  const handlePresetChange = (value) => {
    setDatePreset(value)
    if (value === 'custom') return
    const preset = DATE_PRESETS.find(p => p.value === value)
    if (preset) {
      setDateRange({ startDate: preset.start, endDate: preset.end })
    }
  }

  const handleCustomApply = () => {
    setDateRange({ startDate: customStart || null, endDate: customEnd || null })
  }

  const activeFilterCount = [
    employee !== 'all',
    datePreset !== 'all',
    channel !== 'all',
    status !== 'all',
  ].filter(Boolean).length

  const themeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor

  const optionStyle = {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    color: isDark ? '#F1F5F9' : '#0F172A',
  }

  const selectClass = `appearance-none text-sm rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer border transition-colors ${
    isDark
      ? 'bg-[#1E293B] border-[#334155] text-[#F1F5F9] hover:border-[#475569]'
      : 'bg-white border-[#E2E8F0] text-[#0F172A] hover:border-[#CBD5E1]'
  }`

  const dateInputClass = `text-sm rounded-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 border transition-colors ${
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
    <header className={`border-b flex-shrink-0 ${isDark ? 'bg-[#0F172A] border-[#334155]' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{title}</h2>
          <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{subtitle} &middot; 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={employee} onChange={(e) => setEmployee(e.target.value)} className={selectClass}>
              <option value="all" style={optionStyle}>All Employees</option>
              {employees.map(emp => (
                <option key={emp.id || emp.name} value={emp.id || emp.name} style={optionStyle}>{emp.full_name || emp.name}</option>
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
              <button onClick={handleCustomApply} className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-medium text-white transition-colors">
                Apply
              </button>
            </>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`${iconBtnClass} relative`}
            title="More filters"
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button onClick={cycleTheme} className={iconBtnClass} title={`Theme: ${mode}`}>
            {(() => { const Icon = themeIcon; return <Icon className="w-4 h-4" /> })()}
          </button>

          <button
            onClick={() => setViewRole(viewRole === 'admin' ? 'team' : 'admin')}
            className={`${iconBtnClass} flex items-center gap-1.5`}
            title={`View: ${viewRole === 'admin' ? 'Admin' : 'Team Member'}`}
          >
            {viewRole === 'admin' ? <Shield className="w-4 h-4 text-blue-400" /> : <User className="w-4 h-4" />}
            <span className="text-xs font-medium hidden xl:inline">{viewRole === 'admin' ? 'Admin' : 'Team'}</span>
          </button>

          <button onClick={resetFilters} className={iconBtnClass} title="Reset filters">
            <RotateCcw className="w-4 h-4" />
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

      {/* Expanded filter row */}
      {showFilters && (
        <div className={`flex items-center gap-3 px-6 py-3 border-t filter-row-enter ${
          isDark ? 'border-[#334155] bg-[#0F172A]/50' : 'border-[#E2E8F0] bg-[#F1F5F9]/50'
        }`}>
          <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>Filters:</span>

          <div className="relative">
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectClass}>
              {CHANNELS.map(c => (
                <option key={c.value} value={c.value} style={optionStyle}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`} />
          </div>

          <div className="relative">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              {STATUSES.map(s => (
                <option key={s.value} value={s.value} style={optionStyle}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`} />
          </div>

          {(channel !== 'all' || status !== 'all') && (
            <button
              onClick={() => { setChannel('all'); setStatus('all') }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </header>
  )
}
