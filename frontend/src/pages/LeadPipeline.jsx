import { useState, useEffect, useMemo } from 'react'
import { Target, Percent, Globe, Crown, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import api from '../api/api'
import KPICard from '../components/KPICard'
import VerticalBarChart from '../components/charts/VerticalBarChart'
import HorizontalBarChart from '../components/charts/HorizontalBarChart'
import MultiLineChart from '../components/charts/MultiLineChart'
import { fmtNum, fmtPct, fmtDate } from '../utils/formatters'

export default function LeadPipeline({ employee, startDate, endDate, onEmployeeSelect }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/api/leads', { params: { employee, start_date: startDate, end_date: endDate } })
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [employee, startDate, endDate])

  const insights = useMemo(() => {
    if (!data) return []
    const lines = []
    const { kpis, conversion_by_employee, geography, by_employee } = data

    if (kpis.top_generator && kpis.top_generator !== 'N/A') {
      const topEmp = by_employee.find(e => e.employee === kpis.top_generator)
      if (topEmp) lines.push(`${kpis.top_generator} leads the team with ${fmtNum(topEmp.leads)} leads generated.`)
    }
    if (kpis.conversion_rate > 0) {
      lines.push(`Team conversion rate stands at ${fmtPct(kpis.conversion_rate)} from connections to leads.`)
    }
    const bestConv = conversion_by_employee.reduce((best, e) =>
      e.conversion_rate > (best?.conversion_rate || 0) ? e : best, null)
    if (bestConv && bestConv.conversion_rate > 0) {
      lines.push(`${bestConv.employee} has the highest conversion rate at ${fmtPct(bestConv.conversion_rate)}.`)
    }
    if (geography.length > 0) {
      lines.push(`Leads span ${kpis.unique_geographies} geographies, with ${geography[0].location} being the top source.`)
    }
    if (kpis.total_leads > 0) {
      lines.push(`Total pipeline: ${fmtNum(kpis.total_leads)} qualified leads across the team.`)
    }
    return lines
  }, [data])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (!data) {
    return <div className="text-center text-content-muted py-20">No data available</div>
  }

  const { kpis, by_employee, geography, monthly_trend, conversion_by_employee, all_leads, has_pipeline_data } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Leads" value={kpis.total_leads} icon={Target} color="#8B5CF6" />
        <KPICard title="Conversion Rate" value={fmtPct(kpis.conversion_rate)} icon={Percent} color="#10B981" />
        <KPICard title="Unique Geographies" value={kpis.unique_geographies} icon={Globe} color="#F59E0B" />
        <KPICard title="Top Generator" value={kpis.top_generator} icon={Crown} color="#3B82F6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-card border border-edge rounded-xl p-5">
              <h3 className="text-base font-semibold text-content mb-4">Leads by Employee</h3>
              {by_employee.length > 0 ? (
                <VerticalBarChart data={by_employee} bars={[{ key: 'leads', name: 'Leads' }]} colored onBarClick={onEmployeeSelect} selectedEmployee={employee !== 'all' ? employee : null} />
              ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
            </div>
            <div className="bg-surface-card border border-edge rounded-xl p-5">
              <h3 className="text-base font-semibold text-content mb-4">Lead Geography</h3>
              {has_pipeline_data && geography.length > 0 ? (
                <HorizontalBarChart data={geography.map(g => ({ ...g, employee: g.location }))} dataKey="count" />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-content-muted text-sm">
                  <AlertCircle className="w-6 h-6 mb-2 opacity-50" />
                  Add detailed lead data to see geography
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-card border border-edge rounded-xl p-5">
            <h3 className="text-base font-semibold text-content mb-4">Monthly Lead Trend</h3>
            {monthly_trend.length > 0 ? (
              <MultiLineChart
                data={monthly_trend}
                lines={[
                  { key: 'leads', name: 'Leads', color: '#8B5CF6' },
                  { key: 'positive_responses', name: 'Positive Responses', color: '#10B981' },
                ]}
              />
            ) : <p className="text-content-muted text-sm text-center py-10">No data</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-card border border-edge rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <h3 className="text-base font-semibold text-content">AI Insights</h3>
            </div>
            {insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                    <p className="text-sm text-content-muted leading-relaxed">{line}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-content-muted text-sm">No insights available</p>}
          </div>

          <div className="bg-surface-card border border-edge rounded-xl p-5">
            <h3 className="text-base font-semibold text-content mb-4">Conversion Rate</h3>
            <div className="space-y-3">
              {conversion_by_employee.map(emp => (
                <div key={emp.employee}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-content">{emp.employee}</span>
                    <span className="text-sm font-medium text-content-muted">{fmtPct(emp.conversion_rate)}</span>
                  </div>
                  <div className="w-full bg-surface rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(emp.conversion_rate, 100)}%`, backgroundColor: emp.color }} />
                  </div>
                </div>
              ))}
              {conversion_by_employee.length === 0 && (
                <p className="text-content-muted text-sm text-center">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-card border border-edge rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-content">All Qualified Leads</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 font-medium">
            {all_leads.length} leads
          </span>
        </div>
        {!has_pipeline_data && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            No detailed lead data. Showing aggregated counts.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-content-muted border-b border-edge">
                <th className="text-left py-3 px-4 font-medium">Date</th>
                <th className="text-left py-3 px-4 font-medium">Client</th>
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Location</th>
                <th className="text-left py-3 px-4 font-medium">Employee</th>
              </tr>
            </thead>
            <tbody>
              {all_leads.length > 0 ? all_leads.map((lead, i) => (
                <tr key={i} className="border-b border-edge/50 hover:bg-surface-hover">
                  <td className="py-3 px-4 text-content-muted">{fmtDate(lead.date)}</td>
                  <td className="py-3 px-4 text-content">{lead.client_name || '-'}</td>
                  <td className="py-3 px-4 text-content">{lead.company || '-'}</td>
                  <td className="py-3 px-4 text-content-muted">{lead.location || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lead.color }} />
                      <span className="text-content">{lead.employee}</span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-content-muted">No leads found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
