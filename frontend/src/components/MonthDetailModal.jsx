import { X } from 'lucide-react'
import { fmtDate, fmtNum } from '../utils/formatters'

export default function MonthDetailModal({ isOpen, onClose, title, data, columns }) {
  if (!isOpen || !data || data.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-card border border-edge rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-edge">
          <h3 className="text-lg font-semibold text-content">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg transition-colors">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>
        <div className="overflow-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                {columns.map(col => (
                  <th key={col.key} className={`py-2 px-3 font-semibold text-content ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-edge/50 hover:bg-surface-hover">
                  {columns.map(col => (
                    <td key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.key === 'date' ? 'text-content-muted' : 'text-content'}`}>
                      {col.format ? col.format(row[col.key]) : (typeof row[col.key] === 'number' ? fmtNum(row[col.key]) : row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
