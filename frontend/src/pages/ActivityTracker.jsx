import { Loader2 } from 'lucide-react'
import { useActivity } from '../hooks/useApi'
import { useFilters } from '../context/FilterContext'
import StackedAreaChart from '../components/charts/StackedAreaChart'
import StackedBarChart from '../components/charts/StackedBarChart'
import VerticalBarChart from '../components/charts/VerticalBarChart'
import { fmtNum, fmtPct } from '../utils/formatters'

export default function ActivityTracker() {
  const { setEmployee } = useFilters()
  const { data, isLoading } = useActivity()

  if (isLoading && !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (!data) {
    return <div className="text-center text-content-muted py-20">No data available</div>
  }

  const { daily_volume, monthly_breakdown, daily_averages, summary_table } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Daily Activity Volume</h3>
          {daily_volume.length > 0 ? (
            <StackedAreaChart
              data={daily_volume}
              xKey="date"
              areas={[
                { key: 'connections', name: 'Connections', color: '#3B82F6' },
                { key: 'follow_ups', name: 'Follow-Ups', color: '#06B6D4' },
                { key: 'inmails', name: 'InMails', color: '#10B981' },
              ]}
              height={320}
              zoomable
            />
          ) : (
            <p className="text-content-muted text-sm text-center py-10">No data</p>
          )}
        </div>
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Monthly Channel Breakdown</h3>
          {monthly_breakdown.length > 0 ? (
            <StackedBarChart
              data={monthly_breakdown}
              xKey="month"
              bars={[
                { key: 'connections', name: 'Connections', color: '#3B82F6' },
                { key: 'follow_ups', name: 'Follow-Ups', color: '#06B6D4' },
                { key: 'inmails', name: 'InMails', color: '#10B981' },
                { key: 'leads', name: 'Leads', color: '#F59E0B' },
              ]}
              height={320}
            />
          ) : (
            <p className="text-content-muted text-sm text-center py-10">No data</p>
          )}
        </div>
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <h3 className="text-base font-semibold text-content mb-4">Daily Averages by Employee</h3>
        {daily_averages.length > 0 ? (
          <VerticalBarChart
            data={daily_averages}
            bars={[
              { key: 'avg_connections', name: 'Avg Connections', color: '#3B82F6' },
              { key: 'avg_follow_ups', name: 'Avg Follow-Ups', color: '#06B6D4' },
            ]}
            height={300}
            onBarClick={setEmployee}
          />
        ) : (
          <p className="text-content-muted text-sm text-center py-10">No data</p>
        )}
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <h3 className="text-base font-semibold text-content mb-4">Employee Activity Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-content-muted border-b border-edge">
                <th className="text-left py-3 px-4 font-medium">Employee</th>
                <th className="text-right py-3 px-4 font-medium">Active Days</th>
                <th className="text-right py-3 px-4 font-medium">Connections</th>
                <th className="text-right py-3 px-4 font-medium">Follow-Ups</th>
                <th className="text-right py-3 px-4 font-medium">InMails</th>
                <th className="text-right py-3 px-4 font-medium">Leads</th>
                <th className="text-right py-3 px-4 font-medium">Avg/Day</th>
                <th className="text-right py-3 px-4 font-medium">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {summary_table.map(row => (
                <tr key={row.employee} className="border-b border-edge/50 hover:bg-surface-hover cursor-pointer" onClick={() => setEmployee(row.employee)}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="text-content font-medium">{row.employee}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-content-muted">{fmtNum(row.active_days)}</td>
                  <td className="text-right py-3 px-4 text-content">{fmtNum(row.total_connections)}</td>
                  <td className="text-right py-3 px-4 text-content">{fmtNum(row.total_follow_ups)}</td>
                  <td className="text-right py-3 px-4 text-content">{fmtNum(row.inmails)}</td>
                  <td className="text-right py-3 px-4 text-content">{fmtNum(row.leads)}</td>
                  <td className="text-right py-3 px-4 text-content-muted">{row.avg_conn_per_day}</td>
                  <td className="text-right py-3 px-4">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">{fmtPct(row.efficiency)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
