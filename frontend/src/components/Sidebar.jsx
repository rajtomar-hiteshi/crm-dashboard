import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Activity, Users, MessageSquare,
  Mail, TrendingUp, Target, ChevronRight, CalendarCheck, Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: 'Master Dashboard', icon: LayoutDashboard },
  { path: '/daily-activity', label: 'Daily Activity', icon: CalendarCheck },
  { path: '/activity', label: 'Activity Tracker', icon: Activity },
  { path: '/connections', label: 'LinkedIn Connections', icon: Users },
  { path: '/followups', label: 'Follow-Ups', icon: MessageSquare },
  { path: '/inmails', label: 'InMail Analytics', icon: Mail },
  { path: '/positive-responses', label: 'Positive Responses', icon: TrendingUp },
  { path: '/leads', label: 'Lead Pipeline', icon: Target },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ onNavigate, currentPath }) {
  const navigate = useNavigate()
  const location = useLocation()
  const activePath = location.pathname

  const handleClick = (path) => {
    navigate(path)
    onNavigate(path)
  }

  return (
    <aside className="w-[280px] h-screen bg-surface border-r border-edge flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-edge">
        <div className="flex items-center gap-3">
          <img src="/logo_hiteshi.jfif" alt="Hiteshi Infotech" className="w-9 h-9 rounded-xl object-contain" />
          <div>
            <h1 className="text-lg font-bold text-content leading-tight">Hiteshi Infotech</h1>
            <p className="text-xs text-content-muted leading-tight">CRM Dashboard</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = activePath === item.path
            return (
              <button
                key={item.path}
                onClick={() => handleClick(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'text-content-muted hover:text-content hover:bg-surface-hover'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-blue-400" />}
              </button>
            )
          })}
        </div>
      </nav>
      <div className="p-4 border-t border-edge">
        <p className="text-xs text-content-faint text-center">Hiteshi Infotech CRM v1.0</p>
      </div>
    </aside>
  )
}
