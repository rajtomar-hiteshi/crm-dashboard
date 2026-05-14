import { X, CheckCircle, AlertTriangle, FileText, Clock, Plus, SkipForward } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString() : n
}

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PERSON_COLORS = { Karishma: '#06B6D4', Ragini: '#10B981', Yashika: '#8B5CF6', Yogita: '#3B82F6' }

export default function SyncResultModal({ result, onClose }) {
  const { isDark } = useTheme()
  const isError = result.status === 'error'

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg max-h-[85vh] flex flex-col"
          style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-edge flex-shrink-0">
            <div className="flex items-center gap-3">
              {isError
                ? <AlertTriangle className="w-6 h-6 text-red-400" />
                : <CheckCircle className="w-6 h-6 text-emerald-400" />
              }
              <h2 className="text-lg font-bold text-content">
                {isError ? 'Sync Failed' : 'Sync Complete'}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
              <X className="w-5 h-5 text-content-muted" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {isError ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-300">{result.error}</p>
              </div>
            ) : (
              <>
                {/* KPI row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface rounded-xl p-4 text-center border border-edge">
                    <FileText className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                    <div className="text-xl font-bold text-content">{result.files_synced}</div>
                    <div className="text-xs text-content-muted">Files Synced</div>
                  </div>
                  <div className="bg-surface rounded-xl p-4 text-center border border-edge">
                    <Plus className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                    <div className="text-xl font-bold text-emerald-400">{fmtNum(result.new_rows_added)}</div>
                    <div className="text-xs text-content-muted">New Rows</div>
                  </div>
                  <div className="bg-surface rounded-xl p-4 text-center border border-edge">
                    <SkipForward className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                    <div className="text-xl font-bold text-content">{fmtNum(result.rows_skipped_already_exist)}</div>
                    <div className="text-xs text-content-muted">Skipped</div>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-content-muted px-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{fmtTime(result.synced_at)}</span>
                  </div>
                  {result.duration_seconds != null && (
                    <span>{result.duration_seconds}s</span>
                  )}
                </div>

                {/* Per-person breakdown */}
                {result.details?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-content">Per Employee</h3>
                    {result.details.map(d => {
                      const short = d.person.split(' ')[0]
                      const color = PERSON_COLORS[short] || '#666'
                      return (
                        <div key={d.person} className="bg-surface rounded-xl p-4 border border-edge">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-sm font-medium text-content">{d.person}</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              d.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {d.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div>
                              <div className="font-semibold text-content">{d.worksheets_synced}</div>
                              <div className="text-content-muted">Worksheets</div>
                            </div>
                            <div>
                              <div className="font-semibold text-emerald-400">{fmtNum(d.new_rows)}</div>
                              <div className="text-content-muted">New</div>
                            </div>
                            <div>
                              <div className="font-semibold text-content-muted">{fmtNum(d.skipped)}</div>
                              <div className="text-content-muted">Skipped</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {result.new_rows_added === 0 && (
                  <div className="text-center py-2 text-sm text-content-muted">
                    All data is already up to date — no new rows found.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
