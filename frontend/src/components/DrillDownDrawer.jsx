import { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, Calendar, Users, TrendingUp, Table2, Activity, Loader2, BarChart3, Database } from 'lucide-react'
import { useDrilldown } from '../hooks/useApi'
import { useFilters } from '../context/FilterContext'
import { useTheme } from '../context/ThemeContext'
import MultiLineChart from './charts/MultiLineChart'
import VerticalBarChart from './charts/VerticalBarChart'
import StackedAreaChart from './charts/StackedAreaChart'
import DataTable from './DataTable'
import { fmtNum, fmtDate, fmtPct, fmtMonth, fmtChartDate } from '../utils/formatters'

const TABS = [
  { id: 'data', label: 'Full Data', icon: Database },
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'daily', label: 'Daily', icon: Calendar },
  { id: 'monthly', label: 'Monthly', icon: BarChart3 },
  { id: 'employees', label: 'By Employee', icon: Users },
  { id: 'recent', label: 'Recent Activity', icon: Table2 },
]

const METRIC_TABLE_CONFIG = {
  connections: {
    endpoint: 'linkedin-connections',
    title: 'All LinkedIn Connections',
    defaultSort: 'activity_date',
    columns: [
      { key: 'activity_date', label: 'Date', sortable: true },
      { key: 'short_name', label: 'Person', sortable: true },
      { key: 'client_linkedin_url', label: 'Client LinkedIn URL', type: 'link', sortable: true },
      { key: 'linkedin_account_used', label: 'Account Used', sortable: true },
      { key: 'connection_message', label: 'Connection Message', type: 'longtext', sortable: false },
      { key: 'geography', label: 'Geography', sortable: true },
      { key: 'company_size', label: 'Company Size', sortable: true },
      { key: 'industry', label: 'Industry', sortable: true },
      { key: 'cadence_sequence', label: 'Cadence', sortable: true },
      { key: 'accepted', label: 'Accepted', sortable: true },
      { key: 'filter_link', label: 'Filter Link', sortable: false },
      { key: 'response_received', label: 'Response', sortable: true },
      { key: 'comments', label: 'Comments', type: 'longtext', sortable: false },
    ],
  },
  followups: {
    endpoint: 'linkedin-followups',
    title: 'All Follow-Up Records',
    defaultSort: 'activity_date',
    columns: [
      { key: 'activity_date', label: 'Date', sortable: true },
      { key: 'short_name', label: 'Person', sortable: true },
      { key: 'client_linkedin_url', label: 'Client LinkedIn URL', type: 'link', sortable: true },
      { key: 'linkedin_account_used', label: 'Account Used', sortable: true },
      { key: 'follow_up_type', label: 'Follow Up Type', sortable: true },
      { key: 'message_sent', label: 'Message Sent', type: 'longtext', sortable: false },
      { key: 'filter_value', label: 'Filter', sortable: true },
      { key: 'cadence', label: 'Cadence', sortable: true },
      { key: 'response_received', label: 'Response', sortable: true },
    ],
  },
  inmails: {
    endpoint: 'linkedin-inmails',
    title: 'All InMail Records',
    defaultSort: 'activity_date',
    columns: [
      { key: 'activity_date', label: 'Date', sortable: true },
      { key: 'short_name', label: 'Person', sortable: true },
      { key: 'client_linkedin_url', label: 'Client LinkedIn URL', type: 'link', sortable: true },
      { key: 'linkedin_account_used', label: 'Account Used', sortable: true },
      { key: 'inmail_message_sent', label: 'InMail Message', type: 'longtext', sortable: false },
      { key: 'geography', label: 'Geography', sortable: true },
      { key: 'company_size', label: 'Company Size', sortable: true },
      { key: 'industry', label: 'Industry', sortable: true },
      { key: 'filter_value', label: 'Filter', sortable: true },
      { key: 'cadence', label: 'Cadence', sortable: true },
    ],
  },
  positive_responses: {
    endpoint: 'positive-responses',
    title: 'All Positive Responses',
    defaultSort: 'response_date',
    columns: [
      { key: 'response_date', label: 'Response Date', sortable: true },
      { key: 'short_name', label: 'Person', sortable: true },
      { key: 'client_type', label: 'Client Type', sortable: true },
      { key: 'client_name', label: 'Client Name', sortable: true },
      { key: 'client_linkedin_id', label: 'Client LinkedIn ID', type: 'link', sortable: true },
      { key: 'linkedin_id_associated', label: 'LinkedIn ID Associated', sortable: true },
      { key: 'connected_date', label: 'Connected Date', sortable: true },
      { key: 'first_follow_up', label: 'First Follow Up', sortable: true },
      { key: 'num_follow_ups_taken', label: 'Follow Ups Taken', sortable: true },
      { key: 'num_gap_days', label: 'Gap Days', sortable: true },
      { key: 'response_quality', label: 'Response Quality', type: 'badge', sortable: true },
      { key: 'client_first_revert', label: 'Client First Revert', type: 'longtext', sortable: false },
      { key: 'chat_summary', label: 'Chat Summary', type: 'longtext', sortable: false },
      { key: 'source', label: 'Source', sortable: true },
    ],
  },
  leads: {
    endpoint: 'leads-generated',
    title: 'All Lead Records',
    defaultSort: 'inquiry_date',
    columns: [
      { key: 'inquiry_date', label: 'Inquiry Date', sortable: true },
      { key: 'short_name', label: 'Person', sortable: true },
      { key: 'client_name', label: 'Client Name', sortable: true },
      { key: 'company_name', label: 'Company', sortable: true },
      { key: 'client_location', label: 'Location', sortable: true },
      { key: 'company_size', label: 'Company Size', sortable: true },
      { key: 'client_designation', label: 'Designation', sortable: true },
      { key: 'client_linkedin_url', label: 'LinkedIn URL', type: 'link', sortable: true },
      { key: 'client_email', label: 'Email', type: 'email', sortable: true },
      { key: 'client_contact_number', label: 'Phone', type: 'phone', sortable: true },
      { key: 'summary', label: 'Summary', type: 'longtext', sortable: false },
      { key: 'next_step', label: 'Next Step', type: 'longtext', sortable: false },
      { key: 'lead_source', label: 'Lead Source', sortable: true },
      { key: 'account', label: 'Account', sortable: true },
      { key: 'current_status', label: 'Status', type: 'badge', sortable: true },
    ],
  },
  response_rate: {
    endpoint: 'positive-responses',
    title: 'Positive Responses (Response Rate)',
    defaultSort: 'response_date',
    columns: [
      { key: 'response_date', label: 'Response Date', sortable: true },
      { key: 'short_name', label: 'Person', sortable: true },
      { key: 'client_type', label: 'Client Type', sortable: true },
      { key: 'client_name', label: 'Client Name', sortable: true },
      { key: 'client_linkedin_id', label: 'Client LinkedIn ID', type: 'link', sortable: true },
      { key: 'response_quality', label: 'Response Quality', type: 'badge', sortable: true },
      { key: 'chat_summary', label: 'Chat Summary', type: 'longtext', sortable: false },
      { key: 'source', label: 'Source', sortable: true },
    ],
  },
  emails: {
    endpoint: 'emails',
    title: 'All Email Records',
    defaultSort: 'activity_date',
    columns: [
      { key: 'activity_date', label: 'Date', sortable: true },
      { key: 'short_name', label: 'Person', sortable: true },
      { key: 'client_name', label: 'Client Name', sortable: true },
      { key: 'client_email', label: 'Client Email', type: 'email', sortable: true },
      { key: 'client_linkedin_url', label: 'LinkedIn URL', type: 'link', sortable: true },
      { key: 'company_name', label: 'Company', sortable: true },
      { key: 'email_content_sent', label: 'Email Content', type: 'longtext', sortable: false },
      { key: 'opportunity_url', label: 'Opportunity URL', type: 'link', sortable: false },
      { key: 'contact_number', label: 'Contact Number', type: 'phone', sortable: true },
      { key: 'reason', label: 'Reason', sortable: true },
      { key: 'next_step', label: 'Next Step', type: 'longtext', sortable: false },
      { key: 'cadence', label: 'Cadence', sortable: true },
    ],
  },
}

const RECENT_COLUMNS = {
  connections: [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'detail', label: 'LinkedIn URL' },
    { key: 'extra', label: 'Geography' },
  ],
  followups: [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'detail', label: 'Type' },
    { key: 'extra', label: 'Message' },
  ],
  inmails: [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'detail', label: 'Message' },
    { key: 'extra', label: 'Geography' },
  ],
  positive_responses: [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'detail', label: 'Client' },
    { key: 'extra', label: 'Quality' },
  ],
  leads: [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'detail', label: 'Client' },
    { key: 'extra', label: 'Company' },
  ],
  emails: [
    { key: 'date', label: 'Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'detail', label: 'Client' },
    { key: 'extra', label: 'Email' },
  ],
}

export default function DrillDownDrawer({ isOpen, onClose, metric, title, color }) {
  const [tab, setTab] = useState('overview')
  const [dateFilter, setDateFilter] = useState(null)
  const drawerRef = useRef(null)
  const { data, isLoading } = useDrilldown(isOpen ? metric : null)
  const { employee, setEmployee } = useFilters()
  const { isDark } = useTheme()

  useEffect(() => {
    if (isOpen) { setTab('overview'); setDateFilter(null) }
  }, [isOpen, metric])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const empDailyKeys = data?.employee_daily?.length > 0
    ? Object.keys(data.employee_daily[0]).filter(k => k !== 'date')
    : []

  const EMPLOYEE_COLORS = {}
  if (data?.by_employee) {
    data.by_employee.forEach(e => { EMPLOYEE_COLORS[e.employee] = e.color })
  }

  const renderOverview = () => {
    if (!data) return null
    const { summary, monthly, by_employee } = data

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <p className="text-xs text-content-muted mb-1">Total</p>
            <p className="text-xl font-bold text-content">
              {metric === 'response_rate' ? fmtPct(summary.total) : fmtNum(summary.total)}
            </p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <p className="text-xs text-content-muted mb-1">Active Days</p>
            <p className="text-xl font-bold text-content">{fmtNum(summary.active_days)}</p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <p className="text-xs text-content-muted mb-1">Daily Average</p>
            <p className="text-xl font-bold text-content">{fmtNum(summary.avg_daily)}</p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <p className="text-xs text-content-muted mb-1">Peak Day</p>
            <p className="text-xl font-bold text-content">{fmtNum(summary.peak_day?.value || 0)}</p>
            {summary.peak_day?.date && (
              <p className="text-xs text-content-faint mt-0.5">{fmtDate(summary.peak_day.date)}</p>
            )}
          </div>
        </div>

        {monthly.length > 0 && (
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <h4 className="text-sm font-semibold text-content mb-3">Monthly Trend</h4>
            <MultiLineChart
              data={monthly}
              lines={[{ key: 'value', name: title, color: color || '#3B82F6' }]}
              height={220}
            />
          </div>
        )}

        {by_employee.length > 0 && (
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <h4 className="text-sm font-semibold text-content mb-3">By Employee</h4>
            <div className="space-y-3">
              {by_employee.map(emp => (
                <div
                  key={emp.employee}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
                  onClick={() => { setEmployee(emp.employee); onClose() }}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
                  <span className="text-sm text-content font-medium flex-1">{emp.employee}</span>
                  <span className="text-sm font-semibold text-content">{metric === 'response_rate' ? fmtPct(emp.value) : fmtNum(emp.value)}</span>
                  <div className="w-20 bg-surface-card rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(emp.pct || 0, 100)}%`, backgroundColor: emp.color }} />
                  </div>
                  <span className="text-xs text-content-muted w-12 text-right">{fmtPct(emp.pct || 0, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderDaily = () => {
    if (!data?.daily?.length && !data?.employee_daily?.length) {
      return <p className="text-content-muted text-sm text-center py-10">No daily data available</p>
    }

    return (
      <div className="space-y-6">
        {data.employee_daily?.length > 0 && empDailyKeys.length > 0 && (
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <h4 className="text-sm font-semibold text-content mb-3">Daily Breakdown by Employee</h4>
            <StackedAreaChart
              data={data.employee_daily}
              xKey="date"
              areas={empDailyKeys.map(k => ({ key: k, name: k, color: EMPLOYEE_COLORS[k] || '#666' }))}
              height={280}
              zoomable
            />
          </div>
        )}

        {data.daily?.length > 0 && (
          <div className="bg-surface rounded-xl p-4 border border-edge">
            <h4 className="text-sm font-semibold text-content mb-3">Daily Values</h4>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="text-content-muted border-b border-edge">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-right py-2 px-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map(row => (
                    <tr
                      key={row.date}
                      className="border-b border-edge/30 hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => { setDateFilter({ from: row.date, to: row.date, label: fmtDate(row.date) }); setTab('data') }}
                    >
                      <td className="py-2 px-3 text-blue-400 hover:text-blue-300">{fmtDate(row.date)}</td>
                      <td className="py-2 px-3 text-right text-content font-medium">{fmtNum(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderMonthly = () => {
    if (!data?.monthly?.length) {
      return <p className="text-content-muted text-sm text-center py-10">No monthly data available</p>
    }

    return (
      <div className="space-y-6">
        <div className="bg-surface rounded-xl p-4 border border-edge">
          <h4 className="text-sm font-semibold text-content mb-3">Monthly Trend</h4>
          <MultiLineChart
            data={data.monthly}
            lines={[{ key: 'value', name: title, color: color || '#3B82F6' }]}
            height={260}
          />
        </div>

        <div className="bg-surface rounded-xl p-4 border border-edge">
          <h4 className="text-sm font-semibold text-content mb-3">Monthly Breakdown</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-content-muted border-b border-edge">
                <th className="text-left py-2 px-3 font-medium">Month</th>
                <th className="text-right py-2 px-3 font-medium">Value</th>
                {data.monthly[0]?.responses !== undefined && (
                  <>
                    <th className="text-right py-2 px-3 font-medium">Responses</th>
                    <th className="text-right py-2 px-3 font-medium">Connections</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.monthly.map(row => {
                const monthStart = row.month + '-01'
                const d = new Date(monthStart)
                const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
                return (
                <tr
                  key={row.month}
                  className="border-b border-edge/30 hover:bg-surface-hover cursor-pointer transition-colors"
                  onClick={() => { setDateFilter({ from: monthStart, to: monthEnd, label: fmtMonth(row.month) }); setTab('data') }}
                >
                  <td className="py-2 px-3 text-blue-400 hover:text-blue-300">{fmtMonth(row.month)}</td>
                  <td className="py-2 px-3 text-right text-content font-semibold">
                    {metric === 'response_rate' ? fmtPct(row.value) : fmtNum(row.value)}
                  </td>
                  {row.responses !== undefined && (
                    <>
                      <td className="py-2 px-3 text-right text-content-muted">{fmtNum(row.responses)}</td>
                      <td className="py-2 px-3 text-right text-content-muted">{fmtNum(row.connections)}</td>
                    </>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderEmployees = () => {
    if (!data?.by_employee?.length) {
      return <p className="text-content-muted text-sm text-center py-10">No employee data available</p>
    }

    return (
      <div className="space-y-6">
        <div className="bg-surface rounded-xl p-4 border border-edge">
          <h4 className="text-sm font-semibold text-content mb-3">Employee Comparison</h4>
          <VerticalBarChart
            data={data.by_employee.map(e => ({ ...e, employee: e.employee, [metric]: e.value }))}
            bars={[{ key: metric === 'response_rate' ? 'value' : 'value', name: title }]}
            colored
            height={250}
            onBarClick={(name) => { setEmployee(name); onClose() }}
            selectedEmployee={employee !== 'all' ? employee : null}
          />
        </div>

        <div className="bg-surface rounded-xl p-4 border border-edge">
          <h4 className="text-sm font-semibold text-content mb-3">Employee Details</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-content-muted border-b border-edge">
                <th className="text-left py-2 px-3 font-medium">Employee</th>
                <th className="text-right py-2 px-3 font-medium">Total</th>
                <th className="text-right py-2 px-3 font-medium">Share</th>
                <th className="text-right py-2 px-3 font-medium">Active Days</th>
                <th className="text-right py-2 px-3 font-medium">Avg/Day</th>
              </tr>
            </thead>
            <tbody>
              {data.by_employee.map(emp => (
                <tr
                  key={emp.employee}
                  className="border-b border-edge/30 hover:bg-surface-hover cursor-pointer transition-colors"
                  onClick={() => { setEmployee(emp.employee); onClose() }}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: emp.color }} />
                      <span className="text-content font-medium">{emp.employee}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-content font-semibold">
                    {metric === 'response_rate' ? fmtPct(emp.value) : fmtNum(emp.value)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-surface-card rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${emp.pct || 0}%`, backgroundColor: emp.color }} />
                      </div>
                      <span className="text-xs text-content-muted">{fmtPct(emp.pct || 0, 0)}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-content-muted">{emp.active_days || '-'}</td>
                  <td className="py-2 px-3 text-right text-content-muted">{emp.avg_daily || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderRecent = () => {
    if (!data?.recent?.length) {
      return <p className="text-content-muted text-sm text-center py-10">No recent activity data</p>
    }

    const columns = RECENT_COLUMNS[metric] || RECENT_COLUMNS.connections

    return (
      <div className="bg-surface rounded-xl p-4 border border-edge">
        <h4 className="text-sm font-semibold text-content mb-3">Recent Activity ({data.recent.length} records)</h4>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-content-muted border-b border-edge">
                {columns.map(col => (
                  <th key={col.key} className="text-left py-2 px-3 font-medium">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent.map((row, i) => (
                <tr key={i} className="border-b border-edge/30 hover:bg-surface-hover">
                  {columns.map(col => (
                    <td key={col.key} className={`py-2 px-3 ${col.key === 'date' ? 'text-content-muted' : 'text-content'}`}>
                      {col.key === 'date' ? fmtDate(row[col.key]) :
                       col.key === 'employee' ? (
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                           <span>{row[col.key]}</span>
                         </div>
                       ) : (
                         <span className="truncate block max-w-[200px]" title={row[col.key]}>{row[col.key] || '-'}</span>
                       )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderData = () => {
    const cfg = METRIC_TABLE_CONFIG[metric]
    if (!cfg) return <p className="text-content-muted text-sm text-center py-10">No data table available for this metric</p>
    return (
      <div className="space-y-3">
        {dateFilter && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400">Filtered to: {dateFilter.label}</span>
            <button
              onClick={() => setDateFilter(null)}
              className="ml-auto p-0.5 hover:bg-blue-500/20 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5 text-blue-400" />
            </button>
          </div>
        )}
        <DataTable
          endpoint={cfg.endpoint}
          title={cfg.title}
          defaultSort={cfg.defaultSort}
          columns={cfg.columns}
          dateFrom={dateFilter?.from}
          dateTo={dateFilter?.to}
        />
      </div>
    )
  }

  const renderContent = () => {
    if (tab === 'data') return renderData()

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )
    }
    if (!data) {
      return <p className="text-content-muted text-sm text-center py-10">No data available</p>
    }

    switch (tab) {
      case 'overview': return renderOverview()
      case 'daily': return renderDaily()
      case 'monthly': return renderMonthly()
      case 'employees': return renderEmployees()
      case 'recent': return renderRecent()
      default: return renderData()
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 drawer-backdrop"
        style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full z-50 flex flex-col drawer-slide-in"
        style={{
          width: '70vw',
          maxWidth: '70vw',
          background: isDark ? '#0f172a' : '#FFFFFF',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
          borderRadius: '20px 0 0 20px',
          boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)' : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${color || '#3B82F6'}15` }}>
              <TrendingUp className="w-5 h-5" style={{ color: color || '#3B82F6' }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-content-muted">
                <span>Dashboard</span>
                <ChevronRight className="w-3 h-3" />
                <span className="font-medium text-content">{title}</span>
              </div>
              <h3 className="text-lg font-bold text-content truncate">{title} Analytics</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-edge flex-shrink-0 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-content-muted hover:text-content hover:border-edge'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>
      </div>
    </>
  )
}
