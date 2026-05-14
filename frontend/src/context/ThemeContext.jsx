import { createContext, useContext, useState, useEffect, useMemo } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('theme-mode') || 'light')
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme-mode')
    if (!saved || saved === 'light') return false
    if (saved === 'dark') return true
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    localStorage.setItem('theme-mode', mode)
    const root = document.documentElement

    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
      setIsDark(prefersDark)
    } else {
      const dark = mode === 'dark'
      root.classList.toggle('dark', dark)
      setIsDark(dark)
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      document.documentElement.classList.toggle('dark', e.matches)
      setIsDark(e.matches)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mode])

  const cycleTheme = () => {
    setMode(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark')
  }

  const chartColors = useMemo(() => ({
    axis: isDark ? '#94A3B8' : '#64748B',
    grid: isDark ? '#334155' : '#E2E8F0',
    tooltipBg: isDark ? '#1E293B' : '#FFFFFF',
    tooltipBorder: isDark ? '#334155' : '#E2E8F0',
    tooltipText: isDark ? '#FFFFFF' : '#0F172A',
    tooltipSec: isDark ? '#94A3B8' : '#64748B',
    brushFill: isDark ? '#1E293B' : '#F1F5F9',
    brushStroke: '#3B82F6',
  }), [isDark])

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark, cycleTheme, chartColors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
