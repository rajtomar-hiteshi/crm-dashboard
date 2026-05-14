import { useState, useMemo } from 'react'
import { Users, MessageSquare, Mail, TrendingUp, Target, Award, Loader2 } from 'lucide-react'
import { useDashboard } from '../hooks/useApi'
import { useFilters } from '../context/FilterContext'
import KPICard from '../components/KPICard'
import DrillDownDrawer from '../components/DrillDownDrawer'
import MultiLineChart from '../components/charts/MultiLineChart'
import DonutChart from '../components/charts/DonutChart'
import VerticalBarChart from '../components/charts/VerticalBarChart'
import MonthDetailModal from '../components/MonthDetailModal'
import { fmtNum, fmtPct } from '../utils/formatters'

export default function MasterDashboard() {
  const { employee, setEmployee } = useFilters()
  const { data, isLoading } = useDashboard()
  const [modal, setModal] = useState({ open: false, title: '', data: [] })
  const [drillDown, setDrillDown] = useState({ open: false, metric: null, title: '', color: '' })

  const kpiDetails = useMemo(() => {
    if (!data?.employee_comparison) return {}
    const emps = data.employee_comparison
    const top = (key) => [...emps].sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, 3).map(e => ({ name: e.employee, value: e[key] || 0, color: e.color }))
    return {
      connections: top('connections'),
      follow_ups: top('follow_ups'),
      inmails: top('inmails'),
    }
  }, [data])

  const prDetails = useMemo(() => {
    if (!data?.top_performers) return []
    return data.top_performers.slice(0, 3).map(p => ({ name: p.employee, value: p.responses, color: p.color }))
  }, [data])

  const leadDetails = useMemo(() => {
    if (!data?.top_performers) return []
    return data.top_performers.slice(0, 3).map(p => ({ name: p.employee, value: p.leads, color: p.color }))
  }, [data])

  const handleMonthClick = (point) => {
    if (!point?.month) return
    setModal({ open: true, title: `Details for ${point.month}`, data: [point] })
  }

  const handleDrillDown = (metric, title, color) => {
    setDrillDown({ open: true, metric, title, color })
  }

  if (isLoading && !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (!data) {
    return <div className="text-center text-content-muted py-20">No data available</div>
  }

  const { kpis, monthly_trend, connection_share, employee_comparison, key_metrics, top_performers } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title="Total Connections" value={kpis.total_connections} icon={Users} color="#3B82F6" details={kpiDetails.connections} onDetailClick={setEmployee} metric="connections" onDrillDown={handleDrillDown} />
        <KPICard title="Follow-Ups" value={kpis.total_followups} icon={MessageSquare} color="#06B6D4" details={kpiDetails.follow_ups} onDetailClick={setEmployee} metric="followups" onDrillDown={handleDrillDown} />
        <KPICard title="InMails Sent" value={kpis.total_inmails} icon={Mail} color="#10B981" details={kpiDetails.inmails} onDetailClick={setEmployee} metric="inmails" onDrillDown={handleDrillDown} />
        <KPICard title="Positive Responses" value={kpis.total_positive_responses} icon={TrendingUp} color="#F59E0B" details={prDetails} onDetailClick={setEmployee} metric="positive_responses" onDrillDown={handleDrillDown} />
        <KPICard title="Leads Generated" value={kpis.total_leads} icon={Target} color="#8B5CF6" details={leadDetails} onDetailClick={setEmployee} metric="leads" onDrillDown={handleDrillDown} />
        <KPICard title="Response Rate" value={fmtPct(kpis.response_rate)} icon={Award} color="#EF4444" metric="response_rate" onDrillDown={handleDrillDown} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Monthly Activity Trend</h3>
          {monthly_trend.length > 0 ? (
            <MultiLineChart
              data={monthly_trend}
              lines={[
                { key: 'connections', name: 'Connections', color: '#3B82F6' },
                { key: 'follow_ups', name: 'Follow-Ups', color: '#06B6D4' },
                { key: 'inmails', name: 'InMails', color: '#10B981' },
                { key: 'leads', name: 'Leads', color: '#F59E0B' },
              ]}
              onPointClick={handleMonthClick}
            />
          ) : (
            <p className="text-content-muted text-sm text-center py-10">No trend data</p>
          )}
        </div>
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Connection Share by Employee</h3>
          {connection_share.length > 0 ? (
            <DonutChart
              data={connection_share}
              onSliceClick={setEmployee}
              selectedEmployee={employee !== 'all' ? employee : null}
            />
          ) : (
            <p className="text-content-muted text-sm text-center py-10">No data</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Employee Activity Comparison</h3>
          {employee_comparison.length > 0 ? (
            <VerticalBarChart
              data={employee_comparison}
              bars={[
                { key: 'connections', name: 'Connections', color: '#3B82F6' },
                { key: 'follow_ups', name: 'Follow-Ups', color: '#06B6D4' },
                { key: 'inmails', name: 'InMails', color: '#10B981' },
              ]}
              onBarClick={setEmployee}
              selectedEmployee={employee !== 'all' ? employee : null}
            />
          ) : (
            <p className="text-content-muted text-sm text-center py-10">No data</p>
          )}
        </div>

        {key_metrics ? (
          <div className="bg-surface-card border border-edge rounded-xl p-5">
            <h3 className="text-base font-semibold text-content mb-4">Key Metrics</h3>
            <div className="space-y-4">
              {[
                { label: 'Conversion Rate', value: key_metrics.conversion_rate, color: '#3B82F6' },
                { label: 'Response Rate', value: key_metrics.response_rate, color: '#10B981' },
                { label: 'InMail Rate', value: key_metrics.inmail_rate, color: '#F59E0B' },
                { label: 'Follow-Up Coverage', value: key_metrics.fu_coverage, color: '#8B5CF6' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm text-content-muted">{m.label}</span>
                    <span className="text-sm font-semibold text-content">{fmtPct(m.value)}</span>
                  </div>
                  <div className="w-full bg-surface rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(m.value, 100)}%`, backgroundColor: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-surface-card border border-edge rounded-xl p-5">
            <h3 className="text-base font-semibold text-content mb-4">Top Performers</h3>
            <div className="space-y-3">
              {top_performers.slice(0, 5).map(p => (
                <div key={p.employee} className="flex items-center gap-3 cursor-pointer hover:bg-surface-hover p-1 -mx-1 rounded-lg transition-colors" onClick={() => setEmployee(p.employee)}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: `${p.color}20`, color: p.color }}>
                    {p.rank}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-content">{p.employee}</p>
                    <p className="text-xs text-content-muted">{fmtNum(p.leads)} leads &middot; {fmtNum(p.responses)} responses &middot; {fmtNum(p.connections)} conn.</p>
                  </div>
                </div>
              ))}
              {top_performers.length === 0 && (
                <p className="text-content-muted text-sm text-center py-4">No data</p>
              )}
            </div>
          </div>
        )}
      </div>

      <MonthDetailModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, title: '', data: [] })}
        title={modal.title}
        data={modal.data}
        columns={[
          { key: 'month', label: 'Month', align: 'left' },
          { key: 'connections', label: 'Connections', align: 'right' },
          { key: 'follow_ups', label: 'Follow-Ups', align: 'right' },
          { key: 'inmails', label: 'InMails', align: 'right' },
          { key: 'leads', label: 'Leads', align: 'right' },
        ]}
      />

      <DrillDownDrawer
        isOpen={drillDown.open}
        onClose={() => setDrillDown({ open: false, metric: null, title: '', color: '' })}
        metric={drillDown.metric}
        title={drillDown.title}
        color={drillDown.color}
      />
    </div>
  )
}
