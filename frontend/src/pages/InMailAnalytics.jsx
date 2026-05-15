import { useState, useMemo } from 'react'
import { Mail, Crown, TrendingUp, Percent, Loader2 } from 'lucide-react'
import { useInMails } from '../hooks/useApi'
import { useFilters } from '../context/FilterContext'
import KPICard from '../components/KPICard'
import DrillDownDrawer from '../components/DrillDownDrawer'
import DonutChart from '../components/charts/DonutChart'
import StackedBarChart from '../components/charts/StackedBarChart'
import { fmtNum, fmtPct } from '../utils/formatters'
import DataTable from '../components/DataTable'

const EMPLOYEE_COLORS = {
  Yogita: '#3B82F6', Karishma: '#06B6D4', Ragini: '#10B981',
  Tanishqa: '#F59E0B', Yashika: '#8B5CF6', Seema: '#EF4444', Arni: '#F97316',
}

export default function InMailAnalytics() {
  const { employee, setEmployee } = useFilters()
  const { data, isLoading } = useInMails()
  const [drillDown, setDrillDown] = useState({ open: false, metric: null, title: '', color: '' })

  const monthlyBars = useMemo(() => {
    if (!data?.monthly_volume?.length) return []
    const keys = Object.keys(data.monthly_volume[0]).filter(k => k !== 'month')
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

  const { kpis, distribution, monthly_volume, metrics_table } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total InMails" value={kpis.total} icon={Mail} color="#10B981" details={kpiDetails} onDetailClick={setEmployee} metric="inmails" onDrillDown={handleDrillDown} />
        <KPICard title="Top InMailer" value={kpis.top_inmailer} icon={Crown} color="#F59E0B" />
        <KPICard title="Highest Daily Avg" value={kpis.highest_daily_avg} icon={TrendingUp} color="#3B82F6" />
        <KPICard title="IM:Conn Ratio" value={fmtPct(kpis.avg_im_conn_ratio)} icon={Percent} color="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">InMail Distribution</h3>
          {distribution.length > 0 ? (
            <DonutChart data={distribution} dataKey="inmails" onSliceClick={setEmployee} selectedEmployee={employee !== 'all' ? employee : null} />
          ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
        </div>
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">InMail Volume by Employee</h3>
          {monthly_volume.length > 0 && monthlyBars.length > 0 ? (
            <StackedBarChart data={monthly_volume} xKey="month" bars={monthlyBars} />
          ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
        </div>
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <h3 className="text-base font-semibold text-content mb-4">InMail Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                <th className="text-left py-3 px-4 font-semibold text-content">Employee</th>
                <th className="text-right py-3 px-4 font-semibold text-content">Total</th>
                <th className="text-right py-3 px-4 font-semibold text-content">Avg/Active Day</th>
                <th className="text-right py-3 px-4 font-semibold text-content">Peak Day</th>
                <th className="text-right py-3 px-4 font-semibold text-content">IM:Conn Ratio</th>
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
                  <td className="text-right py-3 px-4 text-content-muted">{row.avg_per_active_day}</td>
                  <td className="text-right py-3 px-4 text-content">{fmtNum(row.peak_day)}</td>
                  <td className="text-right py-3 px-4 text-content-muted">{fmtPct(row.im_conn_ratio)}</td>
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
        endpoint="linkedin-inmails"
        title="All InMail Records"
        defaultSort="activity_date"
        columns={[
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
