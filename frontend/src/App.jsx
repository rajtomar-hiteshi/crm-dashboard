import { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import SyncResultModal from './components/SyncResultModal'
import MasterDashboard from './pages/MasterDashboard'
import ActivityTracker from './pages/ActivityTracker'
import LinkedInConnections from './pages/LinkedInConnections'
import FollowUps from './pages/FollowUps'
import InMailAnalytics from './pages/InMailAnalytics'
import PositiveResponses from './pages/PositiveResponses'
import LeadPipeline from './pages/LeadPipeline'
import api from './api/api'

const PAGE_CONFIG = {
  '/': { title: 'Master Dashboard', subtitle: 'Complete overview of lead generation performance' },
  '/activity': { title: 'Activity Tracker', subtitle: 'Daily and monthly activity breakdown' },
  '/connections': { title: 'LinkedIn Connections', subtitle: 'Connection metrics and trends' },
  '/followups': { title: 'Follow-Ups', subtitle: 'Follow-up activity and coverage analysis' },
  '/inmails': { title: 'InMail Analytics', subtitle: 'InMail volume and distribution insights' },
  '/positive-responses': { title: 'Positive Responses', subtitle: 'Response quality and conversion tracking' },
  '/leads': { title: 'Lead Pipeline', subtitle: 'Lead generation funnel and geography analysis' },
}

export default function App() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [currentPath, setCurrentPath] = useState('/')
  const queryClient = useQueryClient()

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await api.post('/api/sync')
      setSyncResult(res.data)
      queryClient.invalidateQueries()
    } catch (e) {
      console.error('Sync failed:', e)
      setSyncResult({
        status: 'error',
        synced_at: new Date().toISOString(),
        files_synced: 0,
        new_rows_added: 0,
        rows_skipped_already_exist: 0,
        error: e.response?.data?.detail || e.message || 'Sync failed',
        details: [],
      })
    } finally {
      setSyncing(false)
    }
  }, [queryClient])

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
            <Route path="/activity" element={<ActivityTracker />} />
            <Route path="/connections" element={<LinkedInConnections />} />
            <Route path="/followups" element={<FollowUps />} />
            <Route path="/inmails" element={<InMailAnalytics />} />
            <Route path="/positive-responses" element={<PositiveResponses />} />
            <Route path="/leads" element={<LeadPipeline />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {syncResult && (
        <SyncResultModal result={syncResult} onClose={() => setSyncResult(null)} />
      )}
    </div>
  )
}
