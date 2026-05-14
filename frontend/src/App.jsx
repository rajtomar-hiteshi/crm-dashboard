import { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MasterDashboard from './pages/MasterDashboard'
import ActivityTracker from './pages/ActivityTracker'
import LinkedInConnections from './pages/LinkedInConnections'
import FollowUps from './pages/FollowUps'
import InMailAnalytics from './pages/InMailAnalytics'
import PositiveResponses from './pages/PositiveResponses'
import LeadPipeline from './pages/LeadPipeline'
import DailyActivity from './pages/DailyActivity'
import SettingsPage from './pages/SettingsPage'
import api from './api/api'

const PAGE_CONFIG = {
  '/': { title: 'Master Dashboard', subtitle: 'Complete overview of lead generation performance' },
  '/daily-activity': { title: 'Daily Activity', subtitle: 'Track daily team activity with targets and drill-downs' },
  '/activity': { title: 'Activity Tracker', subtitle: 'Daily and monthly activity breakdown' },
  '/connections': { title: 'LinkedIn Connections', subtitle: 'Connection metrics and trends' },
  '/followups': { title: 'Follow-Ups', subtitle: 'Follow-up activity and coverage analysis' },
  '/inmails': { title: 'InMail Analytics', subtitle: 'InMail volume and distribution insights' },
  '/positive-responses': { title: 'Positive Responses', subtitle: 'Response quality and conversion tracking' },
  '/leads': { title: 'Lead Pipeline', subtitle: 'Lead generation funnel and geography analysis' },
  '/settings': { title: 'Settings', subtitle: 'Manage team members, targets, and system configuration' },
}

export default function App() {
  const [syncing, setSyncing] = useState(false)
  const [currentPath, setCurrentPath] = useState('/')

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await api.post('/api/sync')
    } catch (e) {
      console.error('Sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }, [])

  const pageConfig = PAGE_CONFIG[currentPath] || PAGE_CONFIG['/']

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar onNavigate={setCurrentPath} currentPath={currentPath} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={pageConfig.title}
          subtitle={pageConfig.subtitle}
          onSync={handleSync}
          syncing={syncing}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<MasterDashboard />} />
            <Route path="/daily-activity" element={<DailyActivity />} />
            <Route path="/activity" element={<ActivityTracker />} />
            <Route path="/connections" element={<LinkedInConnections />} />
            <Route path="/followups" element={<FollowUps />} />
            <Route path="/inmails" element={<InMailAnalytics />} />
            <Route path="/positive-responses" element={<PositiveResponses />} />
            <Route path="/leads" element={<LeadPipeline />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
