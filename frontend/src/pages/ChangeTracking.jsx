import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  GitCompareArrows, Loader2, CheckCircle2, XCircle, Filter,
  ChevronLeft, ChevronRight, ArrowUpDown, Clock, AlertTriangle,
} from 'lucide-react'
import api from '../api/api'
import { usePersons } from '../hooks/useApi'

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
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
    case 'all': return { from: null, to: null }
    default: return { from: null, to: null }
  }
}

function fmtDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDate(s) {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function truncate(s, len = 40) {
  if (!s) return '-'
  return s.length > len ? s.slice(0, len) + '...' : s
}

export default function ChangeTracking() {
  const [datePreset, setDatePreset] = useState('this_week')
  const [employee, setEmployee] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 50

  const { data: persons } = usePersons()
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset])

  const params = useMemo(() => {
    const p = { page, limit }
    if (employee !== 'all') p.employee = employee
    if (dateRange.from) p.date_from = dateRange.from
    if (dateRange.to) p.date_to = dateRange.to
    if (status !== 'all') p.status = status
    return p
  }, [employee, dateRange, status, page, limit])

  const { data, isLoading } = useQuery({
    queryKey: ['change-tracking', params],
    queryFn: () => api.get('/api/change-tracking', { params }).then(r => r.data),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const summary = data?.summary || {}
  const changes = data?.data || []
  const totalPages = data?.total_pages || 1
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Changes" value={summary.total_changes || 0} icon={GitCompareArrows} color="blue" />
        <SummaryCard label="Applied" value={summary.applied || 0} icon={CheckCircle2} color="emerald" />
        <SummaryCard label="Rejected" value={summary.rejected || 0} icon={XCircle} color="red" />
        <SummaryCard label="Updates" value={summary.updated || 0} icon={ArrowUpDown} color="purple" />
      </div>

      {/* Filters */}
      <div className="bg-surface-card border border-edge rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-content-muted" />

          {/* Employee Filter */}
          <select
            value={employee}
            onChange={e => { setEmployee(e.target.value); setPage(1) }}
            className="bg-surface border border-edge rounded-lg px-3 py-2 text-sm text-content focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Employees</option>
            {persons?.map(p => (
              <option key={p.short_name} value={p.short_name}>{p.full_name}</option>
            ))}
          </select>

          {/* Date Presets */}
          <div className="flex gap-1">
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.key}
                onClick={() => { setDatePreset(preset.key); setPage(1) }}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                  datePreset === preset.key
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'text-content-muted border-edge hover:border-blue-500/30 hover:text-content'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="bg-surface border border-edge rounded-lg px-3 py-2 text-sm text-content focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="applied">Applied Only</option>
            <option value="rejected">Rejected Only</option>
          </select>

          <span className="text-xs text-content-muted ml-auto">
            {total} change{total !== 1 ? 's' : ''} found
          </span>
        </div>
      </div>

      {/* Change Log Table */}
      <div className="bg-surface-card border border-edge rounded-xl overflow-hidden">
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-content-muted">
            <GitCompareArrows className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No changes detected yet</p>
            <p className="text-xs mt-1 opacity-60">Changes will appear here after the next sync</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge bg-surface">
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Detected</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Table</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Worksheet</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Data Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Column</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Old Value</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">New Value</th>
                    <th className="text-left py-3 px-4 font-semibold text-content text-xs uppercase tracking-wider">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map(row => (
                    <tr
                      key={row.id}
                      className={`border-b border-edge/50 transition-colors ${
                        row.change_applied
                          ? 'border-l-4 border-l-emerald-500 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]'
                          : 'border-l-4 border-l-red-500 bg-red-500/[0.03] hover:bg-red-500/[0.06]'
                      }`}
                    >
                      <td className="py-3 px-4">
                        {row.change_applied ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Applied
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-content-muted text-xs whitespace-nowrap">
                        {fmtDateTime(row.detected_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-content font-medium">{row.person_short}</span>
                      </td>
                      <td className="py-3 px-4 text-content-muted text-xs">
                        {row.table_display}
                      </td>
                      <td className="py-3 px-4 text-content-muted text-xs">
                        {row.original_worksheet}
                      </td>
                      <td className="py-3 px-4 text-content-muted text-xs whitespace-nowrap">
                        {fmtDate(row.row_date)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-content font-medium text-xs">{row.column_display}</span>
                      </td>
                      <td className="py-3 px-4">
                        {row.change_type === 'REJECTED_NEW' ? (
                          <span className="text-content-faint text-xs italic">-</span>
                        ) : (
                          <span className="text-red-400 text-xs line-through" title={row.old_value}>
                            {truncate(row.old_value) || <span className="italic text-content-faint">empty</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.change_type === 'REJECTED_NEW' ? (
                          <span className="text-xs text-content-muted italic">New row (after deadline)</span>
                        ) : (
                          <span className="text-emerald-400 text-xs font-medium" title={row.new_value}>
                            {truncate(row.new_value) || <span className="italic text-content-faint">empty</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className={`w-3 h-3 ${row.within_deadline ? 'text-emerald-400' : 'text-red-400'}`} />
                          <span className={row.within_deadline ? 'text-emerald-400' : 'text-red-400'}>
                            {fmtDateTime(row.deadline_at)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-edge">
                <p className="text-xs text-content-muted">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-edge text-content-muted hover:text-content disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) pageNum = i + 1
                    else if (page <= 3) pageNum = i + 1
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                    else pageNum = page - 2 + i
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 text-xs rounded-lg border transition-all ${
                          page === pageNum
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 font-medium'
                            : 'border-edge text-content-muted hover:text-content hover:border-blue-500/30'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-edge text-content-muted hover:text-content disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


function SummaryCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: 'text-blue-400 bg-blue-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  }
  const [iconColor, bgColor] = (colorMap[color] || colorMap.blue).split(' ')

  return (
    <div className="bg-surface-card border border-edge rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-content-muted uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${iconColor}`}>{value.toLocaleString()}</p>
    </div>
  )
}
