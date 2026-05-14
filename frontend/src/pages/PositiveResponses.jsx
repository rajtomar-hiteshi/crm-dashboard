import { useState } from 'react'
import { TrendingUp, Star, ThumbsUp, Award, Loader2, AlertCircle } from 'lucide-react'
import { usePositiveResponses } from '../hooks/useApi'
import { useFilters } from '../context/FilterContext'
import KPICard from '../components/KPICard'
import DrillDownDrawer from '../components/DrillDownDrawer'
import VerticalBarChart from '../components/charts/VerticalBarChart'
import DonutChart from '../components/charts/DonutChart'
import MultiLineChart from '../components/charts/MultiLineChart'
import { fmtNum, fmtPct, fmtDate } from '../utils/formatters'
import DataTable from '../components/DataTable'

export default function PositiveResponses() {
  const { setEmployee } = useFilters()
  const { data, isLoading } = usePositiveResponses()
  const [drillDown, setDrillDown] = useState({ open: false, metric: null, title: '', color: '' })

  const handleDrillDown = (metric, title, color) => {
    setDrillDown({ open: true, metric, title, color })
  }

  if (isLoading && !data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (!data) {
    return <div className="text-center text-content-muted py-20">No data available</div>
  }

  const { kpis, by_employee_stacked, quality_distribution, monthly_trend, recent_responses, has_detail_data } = data

  const qualityBadge = (quality) => {
    const q = (quality || '').toLowerCase()
    if (q.includes('high')) return { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'High Quality' }
    if (q.includes('generic')) return { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Generic Interest' }
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Positive Response' }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Responses" value={kpis.total} icon={TrendingUp} color="#10B981" metric="positive_responses" onDrillDown={handleDrillDown} />
        <KPICard title="High Quality" value={kpis.high_quality} icon={Star} color="#3B82F6" />
        <KPICard title="Generic Interest" value={kpis.generic_interest} icon={ThumbsUp} color="#F59E0B" />
        <KPICard title="Best Rate" value={fmtPct(kpis.best_rate)} subtitle={kpis.best_rate_employee} icon={Award} color="#8B5CF6" />
      </div>

      {!has_detail_data && (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Detailed response data not available. Showing aggregated data from daily activity.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Responses by Employee</h3>
          {by_employee_stacked.length > 0 ? (
            <VerticalBarChart
              data={by_employee_stacked}
              bars={[
                { key: 'high_quality', name: 'High Quality', color: '#3B82F6' },
                { key: 'positive_response', name: 'Positive Response', color: '#10B981' },
                { key: 'generic_interest', name: 'Generic Interest', color: '#F59E0B' },
              ]}
              onBarClick={setEmployee}
            />
          ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
        </div>
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-base font-semibold text-content mb-4">Quality Distribution</h3>
          {quality_distribution.some(d => d.value > 0) ? (
            <DonutChart data={quality_distribution} nameKey="name" dataKey="value" />
          ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
        </div>
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <h3 className="text-base font-semibold text-content mb-4">Monthly Trend</h3>
        {monthly_trend.length > 0 ? (
          <MultiLineChart
            data={monthly_trend}
            lines={[
              { key: 'positive_responses', name: 'Positive Responses', color: '#10B981' },
              { key: 'leads', name: 'Leads', color: '#8B5CF6' },
            ]}
          />
        ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <h3 className="text-base font-semibold text-content mb-4">Recent Responses</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-content-muted border-b border-edge">
                <th className="text-left py-3 px-4 font-medium">Date</th>
                <th className="text-left py-3 px-4 font-medium">Client</th>
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Location</th>
                <th className="text-left py-3 px-4 font-medium">Quality</th>
                <th className="text-left py-3 px-4 font-medium">Employee</th>
              </tr>
            </thead>
            <tbody>
              {recent_responses.length > 0 ? recent_responses.map((row, i) => {
                const badge = qualityBadge(row.quality)
                return (
                  <tr key={i} className="border-b border-edge/50 hover:bg-surface-hover">
                    <td className="py-3 px-4 text-content-muted">{fmtDate(row.date)}</td>
                    <td className="py-3 px-4 text-content">{row.client_name || '-'}</td>
                    <td className="py-3 px-4 text-content">{row.company || '-'}</td>
                    <td className="py-3 px-4 text-content-muted">{row.location || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
                    </td>
                    <td className="py-3 px-4 text-content">{row.employee}</td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-content-muted">No recent responses</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataTable
        endpoint="positive-responses"
        title="All Positive Responses"
        defaultSort="response_date"
        columns={[
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
