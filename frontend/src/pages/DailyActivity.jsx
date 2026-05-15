import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users, MessageSquare, Mail, Send, Database, Star, Target, Loader2,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, X, Search,
  Download, ChevronLeft, ChevronRight, LayoutGrid, Table2, Calendar,
  Filter, TrendingUp, TrendingDown,
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import api from '../api/api'
import { useDailyActivity, usePersons } from '../hooks/useApi'
import { fmtNum, fmtDate } from '../utils/formatters'

const ACTIVITY_TYPES = [
  { key: 'connections', label: 'Connections', icon: Users, color: '#3B82F6' },
  { key: 'followups', label: 'Follow Ups', icon: MessageSquare, color: '#06B6D4' },
  { key: 'inmails', label: 'InMails', icon: Mail, color: '#8B5CF6' },
  { key: 'emails', label: 'Emails', icon: Send, color: '#F59E0B' },
  { key: 'data_extraction', label: 'Data Extraction', icon: Database, color: '#64748B' },
  { key: 'positive_responses', label: 'Positive Responses', icon: Star, color: '#10B981' },
  { key: 'leads', label: 'Leads Generated', icon: Target, color: '#EF4444' },
]

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'custom', label: 'Custom Range' },
]

function getDateRange(preset) {
  const today = new Date()
  const fmt = (d) => d.toISOString().split('T')[0]
  switch (preset) {
    case 'today': return { from: fmt(today), to: fmt(today) }
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return { from: fmt(y), to: fmt(y) }
    }
    case 'this_week': {
      const d = today.getDay()
      const mon = new Date(today); mon.setDate(today.getDate() - (d === 0 ? 6 : d - 1))
      return { from: fmt(mon), to: fmt(today) }
    }
    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: fmt(first), to: fmt(today) }
    }
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3)
      const first = new Date(today.getFullYear(), q * 3, 1)
      return { from: fmt(first), to: fmt(today) }
    }
    default: return { from: fmt(today), to: fmt(today) }
  }
}

function getCellColor(value, key, targets) {
  if (value === null || value === undefined) return ''
  const v = Number(value)
  const t = targets || {}
  switch (key) {
    case 'connections': {
      const tgt = t.connections || 100
      if (v >= tgt) return 'bg-emerald-500/15 text-emerald-400'
      if (v >= tgt * 0.7) return 'bg-amber-500/15 text-amber-400'
      return 'bg-red-500/15 text-red-400'
    }
    case 'followups': {
      const tgt = t.followups || 100
      if (v >= tgt) return 'bg-emerald-500/15 text-emerald-400'
      if (v >= tgt * 0.7) return 'bg-amber-500/15 text-amber-400'
      return 'bg-red-500/15 text-red-400'
    }
    case 'inmails': {
      const tgt = t.inmails || 30
      if (v >= tgt) return 'bg-emerald-500/15 text-emerald-400'
      if (v >= tgt * 0.67) return 'bg-amber-500/15 text-amber-400'
      return 'bg-red-500/15 text-red-400'
    }
    case 'emails': {
      const tgt = t.emails || 10
      if (v >= tgt) return 'bg-emerald-500/15 text-emerald-400'
      if (v >= tgt * 0.5) return 'bg-amber-500/15 text-amber-400'
      return 'bg-red-500/15 text-red-400'
    }
    case 'positive_responses': {
      const tgt = t.positive_responses || 2
      if (v >= tgt) return 'bg-emerald-500/15 text-emerald-400'
      if (v >= 1) return 'bg-amber-500/15 text-amber-400'
      return 'bg-red-500/15 text-red-400'
    }
    case 'leads': {
      const tgt = t.leads || 1
      if (v >= tgt) return 'bg-emerald-500/15 text-emerald-400'
      return 'bg-red-500/15 text-red-400'
    }
    default: return ''
  }
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  return (
    <div className="w-20 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color || '#3B82F6'} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function MultiSelect({ options, selected, onChange, placeholder, renderOption }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSelected = selected.length === 0 || selected.length === options.length
  const label = allSelected ? placeholder : selected.length === 1
    ? (renderOption ? renderOption(options.find(o => o.value === selected[0])) : selected[0])
    : `${selected.length} selected`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-content hover:bg-surface-hover transition-colors min-w-[140px]"
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-surface-card border border-edge rounded-xl shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => { onChange([]); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${allSelected ? 'text-blue-400 font-medium' : 'text-content-muted'}`}
          >
            <div className={`w-4 h-4 rounded border ${allSelected ? 'bg-blue-500 border-blue-500' : 'border-edge'} flex items-center justify-center`}>
              {allSelected && <span className="text-white text-xs">&#10003;</span>}
            </div>
            All
          </button>
          {options.map(opt => {
            const isSelected = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (isSelected) onChange(selected.filter(s => s !== opt.value))
                  else onChange([...selected, opt.value])
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${isSelected ? 'text-content font-medium' : 'text-content-muted'}`}
              >
                <div className={`w-4 h-4 rounded border ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-edge'} flex items-center justify-center`}>
                  {isSelected && <span className="text-white text-xs">&#10003;</span>}
                </div>
                {opt.color && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
                <span className="truncate">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}


function DrillDownPanel({ isOpen, onClose, personId, personName, activityType, dateFrom, dateTo }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [personId, activityType, dateFrom, dateTo, debouncedSearch])

  const params = isOpen ? {
    person_id: personId,
    type: activityType,
    date_from: dateFrom,
    date_to: dateTo,
    page,
    limit: 50,
    search: debouncedSearch || undefined,
  } : null

  const { data, isLoading } = useQuery({
    queryKey: ['daily-activity-drilldown', params],
    queryFn: () => api.get('/api/daily-activity/drill-down', { params }).then(r => r.data),
    enabled: !!params,
    staleTime: 60000,
  })

  const handleExport = () => {
    const exportParams = new URLSearchParams({
      person_id: personId,
      type: activityType,
      date_from: dateFrom,
      date_to: dateTo,
      format: 'csv',
    })
    window.open(`/api/daily-activity/export?${exportParams}`, '_blank')
  }

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const typeLabel = ACTIVITY_TYPES.find(a => a.key === activityType)?.label || activityType
  const typeColor = ACTIVITY_TYPES.find(a => a.key === activityType)?.color || '#3B82F6'

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 h-full w-full max-w-3xl z-50 flex flex-col drawer-slide-in"
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px 0 0 20px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-content-muted mb-1">
              <span>Daily Activity</span>
              <ChevronRight className="w-3 h-3" />
              <span className="font-medium" style={{ color: typeColor }}>{typeLabel}</span>
            </div>
            <h3 className="text-lg font-bold text-content truncate">
              {personName} &mdash; {typeLabel}
            </h3>
            <p className="text-xs text-content-muted">
              {dateFrom === dateTo ? fmtDate(dateFrom) : `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-b border-edge flex-shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records..."
              className="w-full pl-9 pr-3 py-2 bg-surface border border-edge rounded-lg text-sm text-content placeholder:text-content-faint focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : !data?.records?.length ? (
            <p className="text-content-muted text-sm text-center py-10">No records found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0f172a] z-10">
                  <tr className="border-b border-edge">
                    <th className="text-left py-2 px-3 font-semibold text-content w-8">#</th>
                    {data.columns?.map(col => (
                      <th key={col.key} className="text-left py-2 px-3 font-semibold text-content">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((row, i) => (
                    <tr key={i} className="border-b border-edge/30 hover:bg-surface-hover">
                      <td className="py-2 px-3 text-content-faint">{(page - 1) * 50 + i + 1}</td>
                      {data.columns?.map(col => (
                        <td key={col.key} className="py-2 px-3 text-content">
                          {col.key.includes('date')
                            ? <span className="text-content-muted">{fmtDate(row[col.key])}</span>
                            : col.key.includes('url') || col.key.includes('linkedin')
                              ? <span className={`truncate block max-w-[220px] font-medium ${!row[col.key] ? 'opacity-50 text-content-faint' : 'text-blue-400 hover:text-blue-300'}`} title={row[col.key]}>{row[col.key] || 'N/A'}</span>
                              : <span className={`truncate block max-w-[200px] ${!row[col.key] ? 'opacity-50 text-content-faint' : 'text-content'}`} title={row[col.key]}>{row[col.key] || 'N/A'}</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-edge flex-shrink-0">
            <span className="text-xs text-content-muted">
              {fmtNum(data.total)} records &middot; Page {data.page} of {data.total_pages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-content-muted" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-content-muted" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}


export default function DailyActivity() {
  const [selectedPersons, setSelectedPersons] = useState([])
  const [datePreset, setDatePreset] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [viewMode, setViewMode] = useState('table')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [drillDown, setDrillDown] = useState(null)

  const { data: persons } = usePersons()

  const dateRange = useMemo(() => {
    if (datePreset === 'custom') return { from: customFrom, to: customTo }
    return getDateRange(datePreset)
  }, [datePreset, customFrom, customTo])

  const queryParams = useMemo(() => {
    const p = {}
    if (selectedPersons.length > 0) p.persons = selectedPersons.join(',')
    if (dateRange.from === dateRange.to) {
      p.date = dateRange.from
    } else {
      p.date_from = dateRange.from
      p.date_to = dateRange.to
    }
    if (selectedTypes.length > 0) p.type = selectedTypes.join(',')
    return p
  }, [selectedPersons, dateRange, selectedTypes])

  const { data, isLoading } = useDailyActivity(queryParams)

  const isSingleDay = data?.is_single_day ?? (dateRange.from === dateRange.to)
  const targets = data?.targets || {}

  const personOptions = useMemo(() => {
    const list = data?.persons || persons || []
    return list.map(p => ({ value: p.id, label: p.short_name || p.full_name, color: p.color }))
  }, [data?.persons, persons])

  const typeOptions = ACTIVITY_TYPES.map(a => ({ value: a.key, label: a.label }))

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const sortedTableData = useMemo(() => {
    if (!data?.table_data) return []
    if (!sortCol) return data.table_data
    const arr = [...data.table_data]
    arr.sort((a, b) => {
      let va, vb
      if (isSingleDay) {
        va = a[sortCol] ?? -1; vb = b[sortCol] ?? -1
      } else {
        va = a[`total_${sortCol}`] ?? a[sortCol] ?? -1
        vb = b[`total_${sortCol}`] ?? b[sortCol] ?? -1
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return arr
  }, [data?.table_data, sortCol, sortDir, isSingleDay])

  const handleCellClick = useCallback((personId, personName, type) => {
    setDrillDown({ personId, personName, type })
  }, [])

  const activeTypes = selectedTypes.length > 0 ? selectedTypes : ACTIVITY_TYPES.map(a => a.key)
  const visibleActivityTypes = ACTIVITY_TYPES.filter(a => activeTypes.includes(a.key))

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 text-content-faint opacity-0 group-hover:opacity-100" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />
  }

  const renderFilterBar = () => (
    <div className="sticky top-0 z-30 bg-surface border-b border-edge px-6 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-content-muted" />
          <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">Filters</span>
        </div>

        <MultiSelect
          options={personOptions}
          selected={selectedPersons}
          onChange={setSelectedPersons}
          placeholder="All Persons"
        />

        <div className="flex items-center bg-surface border border-edge rounded-lg overflow-hidden">
          {DATE_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setDatePreset(p.key)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                datePreset === p.key
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-content focus:outline-none focus:border-blue-500/50"
            />
            <span className="text-content-faint text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-content focus:outline-none focus:border-blue-500/50"
            />
          </div>
        )}

        <MultiSelect
          options={typeOptions}
          selected={selectedTypes}
          onChange={setSelectedTypes}
          placeholder="All Activities"
        />

        <div className="ml-auto flex items-center bg-surface border border-edge rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-blue-500/15 text-blue-400' : 'text-content-muted hover:text-content'}`}
            title="Table View"
          >
            <Table2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 transition-colors ${viewMode === 'card' ? 'bg-blue-500/15 text-blue-400' : 'text-content-muted hover:text-content'}`}
            title="Card View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  const renderSummaryCards = () => {
    if (!data?.summary_cards) return null
    const CARD_ICONS = {
      connections: Users,
      followups: MessageSquare,
      inmails: Mail,
      emails: Send,
      positive_responses: Star,
      leads: Target,
    }
    const CARD_COLORS = {
      connections: '#3B82F6',
      followups: '#06B6D4',
      inmails: '#8B5CF6',
      emails: '#F59E0B',
      positive_responses: '#10B981',
      leads: '#EF4444',
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {data.summary_cards.map(card => {
          const Icon = CARD_ICONS[card.key] || Target
          const color = CARD_COLORS[card.key] || '#3B82F6'
          const isPositive = card.change >= 0
          return (
            <div key={card.key} className="bg-surface-card border border-edge rounded-xl p-4 hover:border-edge/80 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                {card.change !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                  }`}>
                    {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(card.change)}%
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-content">{fmtNum(card.value)}</p>
              <p className="text-xs text-content-muted mt-0.5">{card.label}</p>
              <p className="text-[10px] text-content-faint mt-1">
                vs prev: {fmtNum(card.previous)}
              </p>
            </div>
          )
        })}
      </div>
    )
  }

  const renderCellValue = (value, key, personId, personName) => {
    if (value === null || value === undefined) return <span className="text-content-faint opacity-50">N/A</span>
    const colorClass = getCellColor(value, key, targets)
    return (
      <button
        onClick={() => handleCellClick(personId, personName, key)}
        className={`inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-md text-sm font-medium cursor-pointer hover:ring-1 hover:ring-blue-500/30 transition-all ${colorClass}`}
      >
        {fmtNum(value)}
      </button>
    )
  }

  const renderSingleDayTable = () => (
    <div className="bg-surface-card border border-edge rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-edge">
              <th
                className="text-left py-3 px-4 font-semibold text-content-muted cursor-pointer hover:text-content group"
                onClick={() => handleSort('person_name')}
              >
                <span className="flex items-center gap-1">Person <SortIcon col="person_name" /></span>
              </th>
              <th className="text-left py-3 px-4 font-semibold text-content-muted">Date</th>
              {visibleActivityTypes.map(a => (
                <th
                  key={a.key}
                  className="text-center py-3 px-4 font-semibold text-content-muted cursor-pointer hover:text-content group"
                  onClick={() => handleSort(a.key)}
                >
                  <span className="flex items-center justify-center gap-1">
                    {a.label} <SortIcon col={a.key} />
                  </span>
                </th>
              ))}
              <th
                className="text-center py-3 px-4 font-semibold text-content-muted cursor-pointer hover:text-content group"
                onClick={() => handleSort('total_activity')}
              >
                <span className="flex items-center justify-center gap-1">Total <SortIcon col="total_activity" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTableData.map(row => (
              <tr key={row.person_id} className="border-b border-edge/30 hover:bg-surface-hover transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                    <span className="font-medium text-content">{row.person_name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-content-muted">{fmtDate(row.date)}</td>
                {visibleActivityTypes.map(a => (
                  <td key={a.key} className="py-3 px-4 text-center">
                    {renderCellValue(row[a.key], a.key, row.person_id, row.person_name)}
                  </td>
                ))}
                <td className="py-3 px-4 text-center">
                  <span className="font-bold text-content">{fmtNum(row.total_activity)}</span>
                </td>
              </tr>
            ))}
            {data?.team_total && (
              <tr className="bg-blue-500/5 border-t-2 border-blue-500/20 font-bold">
                <td className="py-3 px-4 text-content" colSpan={2}>TEAM TOTAL</td>
                {visibleActivityTypes.map(a => (
                  <td key={a.key} className="py-3 px-4 text-center text-content">
                    {fmtNum(data.team_total[a.key] || 0)}
                  </td>
                ))}
                <td className="py-3 px-4 text-center text-content">
                  {fmtNum(data.team_total_activity || 0)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderRangeTable = () => (
    <div className="bg-surface-card border border-edge rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-edge">
              <th
                className="text-left py-3 px-4 font-semibold text-content-muted cursor-pointer hover:text-content group"
                onClick={() => handleSort('person_name')}
              >
                <span className="flex items-center gap-1">Person <SortIcon col="person_name" /></span>
              </th>
              {visibleActivityTypes.map(a => (
                <th key={a.key} className="text-center py-3 px-3 font-semibold text-content-muted">
                  <div className="flex flex-col items-center">
                    <span className="cursor-pointer hover:text-content" onClick={() => handleSort(a.key)}>
                      {a.label}
                    </span>
                    <span className="text-[10px] text-content-faint font-normal">Total / Avg</span>
                  </div>
                </th>
              ))}
              <th className="text-center py-3 px-3 font-semibold text-content-muted">Trend</th>
              <th className="text-center py-3 px-3 font-semibold text-content-muted">Best Day</th>
              <th className="text-center py-3 px-3 font-semibold text-content-muted">Worst Day</th>
            </tr>
          </thead>
          <tbody>
            {sortedTableData.map(row => (
              <tr key={row.person_id} className="border-b border-edge/30 hover:bg-surface-hover transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                    <div>
                      <span className="font-medium text-content block">{row.person_name}</span>
                      <span className="text-[10px] text-content-faint">{row.num_days} days</span>
                    </div>
                  </div>
                </td>
                {visibleActivityTypes.map(a => (
                  <td key={a.key} className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleCellClick(row.person_id, row.person_name, a.key)}
                      className="inline-flex flex-col items-center cursor-pointer hover:ring-1 hover:ring-blue-500/30 rounded-md px-2 py-1 transition-all"
                    >
                      <span className="font-semibold text-content">{fmtNum(row[`total_${a.key}`] ?? 0)}</span>
                      <span className="text-[10px] text-content-faint">{row[`avg_${a.key}`] ?? 0}/day</span>
                    </button>
                  </td>
                ))}
                <td className="py-3 px-3 text-center">
                  <Sparkline
                    data={row.sparklines?.connections || []}
                    color={row.color}
                  />
                </td>
                <td className="py-3 px-3 text-center">
                  {row.best_day ? (
                    <div className="flex flex-col items-center">
                      <span className="text-emerald-400 text-xs font-medium">{fmtDate(row.best_day.date)}</span>
                      <span className="text-[10px] text-content-faint">{fmtNum(row.best_day.total)}</span>
                    </div>
                  ) : '-'}
                </td>
                <td className="py-3 px-3 text-center">
                  {row.worst_day ? (
                    <div className="flex flex-col items-center">
                      <span className="text-red-400 text-xs font-medium">{fmtDate(row.worst_day.date)}</span>
                      <span className="text-[10px] text-content-faint">{fmtNum(row.worst_day.total)}</span>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {data?.team_total && (
              <tr className="bg-blue-500/5 border-t-2 border-blue-500/20 font-bold">
                <td className="py-3 px-4 text-content">TEAM TOTAL</td>
                {visibleActivityTypes.map(a => (
                  <td key={a.key} className="py-3 px-3 text-center text-content">
                    {fmtNum(data.team_total[a.key] || 0)}
                  </td>
                ))}
                <td colSpan={3}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sortedTableData.map(row => (
        <div
          key={row.person_id}
          className="bg-surface-card border border-edge rounded-xl p-5 hover:border-blue-500/20 transition-colors"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: row.color }}>
              {(row.person_name || '?')[0]}
            </div>
            <div>
              <h4 className="font-semibold text-content">{row.person_name}</h4>
              <p className="text-xs text-content-muted">
                {isSingleDay ? fmtDate(row.date) : `${fmtDate(row.date_from)} - ${fmtDate(row.date_to)}`}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {visibleActivityTypes.map(a => {
              const val = isSingleDay ? row[a.key] : row[`total_${a.key}`]
              const Icon = a.icon
              const colorClass = isSingleDay && val !== null ? getCellColor(val, a.key, targets) : ''
              return (
                <div
                  key={a.key}
                  className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
                  onClick={() => handleCellClick(row.person_id, row.person_name, a.key)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: a.color }} />
                    <span className="text-sm text-content-muted">{a.label}</span>
                  </div>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded ${colorClass || 'text-content'}`}>
                    {val !== null && val !== undefined ? fmtNum(val) : <span className="opacity-50">N/A</span>}
                    {!isSingleDay && row[`avg_${a.key}`] != null && (
                      <span className="text-[10px] text-content-faint ml-1">({row[`avg_${a.key}`]}/d)</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
            <span className="text-xs text-content-muted">Total Activity</span>
            <span className="text-sm font-bold text-content">{fmtNum(row.total_activity)}</span>
          </div>
        </div>
      ))}
    </div>
  )

  const renderSkeleton = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface-card border border-edge rounded-xl p-4 animate-pulse">
            <div className="h-8 w-8 bg-surface rounded-lg mb-3" />
            <div className="h-6 w-16 bg-surface rounded mb-1" />
            <div className="h-3 w-24 bg-surface rounded" />
          </div>
        ))}
      </div>
      <div className="bg-surface-card border border-edge rounded-xl p-6 animate-pulse">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-surface rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="-mx-6 -mt-6">
      {renderFilterBar()}
      <div className="p-6">
        {isLoading ? renderSkeleton() : (
          <>
            {renderSummaryCards()}
            {viewMode === 'table'
              ? (isSingleDay ? renderSingleDayTable() : renderRangeTable())
              : renderCardView()
            }
          </>
        )}
      </div>

      <DrillDownPanel
        isOpen={!!drillDown}
        onClose={() => setDrillDown(null)}
        personId={drillDown?.personId}
        personName={drillDown?.personName}
        activityType={drillDown?.type}
        dateFrom={dateRange.from}
        dateTo={dateRange.to}
      />
    </div>
  )
}
