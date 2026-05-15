import { useState, useMemo } from 'react'
import { Users, Crown, TrendingUp, Zap, Loader2 } from 'lucide-react'
import { useConnections } from '../hooks/useApi'
import { useFilters } from '../context/FilterContext'
import KPICard from '../components/KPICard'
import DrillDownDrawer from '../components/DrillDownDrawer'
import HorizontalBarChart from '../components/charts/HorizontalBarChart'
import MultiLineChart from '../components/charts/MultiLineChart'
import StackedBarChart from '../components/charts/StackedBarChart'
import { fmtNum } from '../utils/formatters'
import DataTable from '../components/DataTable'

const EMPLOYEE_COLORS = {
  Yogita: '#3B82F6', Karishma: '#06B6D4', Ragini: '#10B981',
  Tanishqa: '#F59E0B', Yashika: '#8B5CF6', Seema: '#EF4444', Arni: '#F97316',
}

export default function LinkedInConnections() {
  const { employee, setEmployee } = useFilters()
  const { data, isLoading } = useConnections()
  const [drillDown, setDrillDown] = useState({ open: false, metric: null, title: '', color: '' })

  const stackedBars = useMemo(() => {
    if (!data?.daily_stacked?.length) return []
    const keys = Object.keys(data.daily_stacked[0]).filter(k => k !== 'date')
    return keys.map(k => ({ key: k, name: k, color: EMPLOYEE_COLORS[k] || '#666' }))
  }, [data])

  const kpiDetails = useMemo(() => {
    if (!data?.metrics_table) return []
    return [...data.metrics_table].sort((a, b) => b.total - a.total).slice(0, 3).map(e => ({ name: e.employee, value: e.total, color: e.color }))
  }, [data])

  const handleDrillDown = (metric, title, color) => {
    setDrillDown({ open: true, metric, title, color })
  }

  if (isLoading && !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (!data) {
    return <div className="text-center text-content-muted py-20">No data available</div>
  }

  const { kpis, by_employee, monthly_trend, daily_stacked, metrics_table } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Connections" value={kpis.total} icon={Users} color="#3B82F6" details={kpiDetails} onDetailClick={setEmployee} metric="connections" onDrillDown={handleDrillDown} />
        <KPICard title="Best Performer" value={kpis.best_performer} icon={Crown} color="#F59E0B" />
        <KPICard title="Highest Daily Avg" value={kpis.highest_daily_avg} icon={TrendingUp} color="#10B981" />
        <KPICard title="Peak Single Day" value={kpis.peak_single_day} icon={Zap} color="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Connections by Employee</h3>
          {by_employee.length > 0 ? (
            <HorizontalBarChart data={by_employee} dataKey="connections" onBarClick={setEmployee} selectedEmployee={employee !== 'all' ? employee : null} />
          ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
        </div>
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Monthly Connection Trend</h3>
          {monthly_trend.length > 0 ? (
            <MultiLineChart data={monthly_trend} lines={[{ key: 'connections', name: 'Connections', color: '#3B82F6' }]} />
          ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
        </div>
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <h3 className="text-base font-semibold text-content mb-4">Daily Connection Volume (Stacked)</h3>
        {daily_stacked.length > 0 && stackedBars.length > 0 ? (
          <StackedBarChart data={daily_stacked} bars={stackedBars} height={350} />
        ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <h3 className="text-base font-semibold text-content mb-4">Connection Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                <th className="text-left py-3 px-4 font-semibold text-content">Employee</th>
                <th className="text-right py-3 px-4 font-semibold text-content">Total</th>
                <th className="text-right py-3 px-4 font-semibold text-content">Active Days</th>
                <th className="text-right py-3 px-4 font-semibold text-content">Avg/Day</th>
                <th className="text-right py-3 px-4 font-semibold text-content">Peak Day</th>
                <th className="text-left py-3 px-4 font-semibold text-content">Share</th>
              </tr>
            </thead>
            <tbody>
              {metrics_table.map(row => (
                <tr key={row.employee} className="border-b border-edge/50 hover:bg-surface-hover cursor-pointer" onClick={() => setEmployee(row.employee)}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="text-content font-medium">{row.employee}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-content">{fmtNum(row.total)}</td>
                  <td className="text-right py-3 px-4 text-content-muted">{row.active_days}</td>
                  <td className="text-right py-3 px-4 text-content-muted">{row.avg_per_day}</td>
                  <td className="text-right py-3 px-4 text-content">{fmtNum(row.peak_day)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-surface rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${row.share_pct}%`, backgroundColor: row.color }} />
                      </div>
                      <span className="text-xs text-content-muted">{row.share_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DataTable
        endpoint="linkedin-connections"
        title="All LinkedIn Connections"
        defaultSort="activity_date"
        columns={[
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
