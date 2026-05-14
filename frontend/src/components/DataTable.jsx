import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, Loader2, ExternalLink, X,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useFilters } from '../context/FilterContext'
import api from '../api/api'

export default function DataTable({ endpoint, columns, defaultSort, defaultSortDir = 'desc', pageSize = 50, title, dateFrom: propDateFrom, dateTo: propDateTo }) {
  const { isDark } = useTheme()
  const { employee, startDate, endDate } = useFilters()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState(defaultSort)
  const [order, setOrder] = useState(defaultSortDir)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedCell, setExpandedCell] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [employee, startDate, endDate, debouncedSearch, propDateFrom, propDateTo])

  const queryParams = useMemo(() => ({
    page, limit: pageSize, sort, order,
    person: employee || 'all',
    date_from: propDateFrom || startDate || undefined,
    date_to: propDateTo || endDate || undefined,
    search: debouncedSearch || undefined,
  }), [page, pageSize, sort, order, employee, startDate, endDate, debouncedSearch, propDateFrom, propDateTo])

  const { data: result, isLoading } = useQuery({
    queryKey: ['data-table', endpoint, queryParams],
    queryFn: () => api.get(`/api/data/${endpoint}`, { params: queryParams }).then(r => r.data),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const rows = result?.data || []
  const total = result?.total || 0
  const totalPages = result?.total_pages || 1

  const handleSort = useCallback((key) => {
    if (sort === key) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(key)
      setOrder('desc')
    }
    setPage(1)
  }, [sort])

  const handleExport = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('format', 'csv')
    if (employee && employee !== 'all') params.set('person', employee)
    if (startDate) params.set('date_from', startDate)
    if (endDate) params.set('date_to', endDate)
    if (debouncedSearch) params.set('search', debouncedSearch)
    const res = await api.get(`/api/data/export/${endpoint}?${params}`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${endpoint}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [endpoint, employee, startDate, endDate, debouncedSearch])

  const renderCell = (row, col, rowIdx) => {
    const val = row[col.key]
    if (val == null || val === '') return <span className="text-content-faint">-</span>

    const cellId = `${rowIdx}-${col.key}`

    if (col.type === 'link' && val) {
      const display = val.length > 40 ? val.slice(0, 40) + '...' : val
      return (
        <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 max-w-[200px]">
          <span className="truncate">{display}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      )
    }

    if (col.type === 'email' && val) {
      return <a href={`mailto:${val}`} className="text-blue-400 hover:text-blue-300">{val}</a>
    }

    if (col.type === 'phone' && val) {
      return <a href={`tel:${val}`} className="text-blue-400 hover:text-blue-300">{val}</a>
    }

    if (col.type === 'badge' && val) {
      const colors = {
        'high quality': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        'generic interest': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
        'active': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        'inactive': 'bg-red-500/15 text-red-400 border-red-500/20',
        'pending': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
      }
      const cls = colors[val.toLowerCase()] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'
      return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{val}</span>
    }

    if (col.type === 'longtext' && val && val.length > 50) {
      const isExpanded = expandedCell === cellId
      return (
        <div>
          <span className="text-content-muted">{isExpanded ? val : val.slice(0, 50) + '...'}</span>
          <button onClick={() => setExpandedCell(isExpanded ? null : cellId)}
            className="ml-1 text-xs text-blue-400 hover:text-blue-300">
            {isExpanded ? 'less' : 'more'}
          </button>
        </div>
      )
    }

    return <span className="text-content-muted">{String(val)}</span>
  }

  const fromRow = (page - 1) * pageSize + 1
  const toRow = Math.min(page * pageSize, total)

  const inputClass = `text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 border transition-colors ${
    isDark ? 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] placeholder-[#475569]'
           : 'bg-white border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8]'
  }`

  return (
    <div className="bg-surface-card border border-edge rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-edge flex-wrap">
        <div className="flex items-center gap-3">
          {title && <h3 className="text-base font-semibold text-content">{title}</h3>}
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium">
            {total.toLocaleString()} records
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search all columns..."
              className={`${inputClass} pl-9 w-56`}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-content-faint hover:text-content">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button onClick={handleExport}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
              isDark ? 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:bg-[#334155]'
                     : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'
            }`}>
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b border-edge ${isDark ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'}`}>
              <th className="text-left py-3 px-4 font-medium text-content-muted w-12">#</th>
              {columns.map(col => (
                <th key={col.key}
                  className={`text-left py-3 px-4 font-medium text-content-muted whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer select-none hover:text-content' : ''}`}
                  style={col.width ? { minWidth: col.width } : undefined}
                  onClick={() => col.sortable !== false && handleSort(col.key)}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && (
                      sort === col.key
                        ? (order === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />)
                        : <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-20 text-center">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-16 text-center text-content-muted">No records found</td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={row.id || i}
                className={`border-b border-edge/50 hover:bg-surface-hover transition-colors ${i % 2 === 1 ? (isDark ? 'bg-[#0F172A]/30' : 'bg-[#F8FAFC]/50') : ''}`}>
                <td className="py-3 px-4 text-content-faint text-xs">{fromRow + i}</td>
                {columns.map(col => (
                  <td key={col.key} className="py-3 px-4 max-w-[300px]">
                    {renderCell(row, col, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-edge">
          <p className="text-xs text-content-muted">
            Showing {fromRow}-{toRow} of {total.toLocaleString()} records
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page <= 1}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-surface-hover text-content-muted transition-colors">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-surface-hover text-content-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {(() => {
              const pages = []
              let start = Math.max(1, page - 2)
              let end = Math.min(totalPages, start + 4)
              if (end - start < 4) start = Math.max(1, end - 4)
              for (let p = start; p <= end; p++) pages.push(p)
              return pages.map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page ? 'bg-blue-600 text-white' : 'text-content-muted hover:bg-surface-hover'
                  }`}>
                  {p}
                </button>
              ))
            })()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-surface-hover text-content-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-surface-hover text-content-muted transition-colors">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
