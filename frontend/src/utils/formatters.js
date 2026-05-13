export function fmtNum(n) {
  return (n ?? 0).toLocaleString()
}

export function fmtPct(n, decimals = 2) {
  return `${(n ?? 0).toFixed(decimals)}%`
}

export function fmtDate(s) {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtMonth(s) {
  if (!s) return ''
  const d = new Date(s + '-01')
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function fmtChartDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
