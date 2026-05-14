import { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import SyncResultModal from './components/SyncResultModal'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
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

function ProtectedLayout() {
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

      {syncResult && (
        <SyncResultModal result={syncResult} onClose={() => setSyncResult(null)} />
      )}
    </div>
  )
}

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/*" element={isAuthenticated ? <ProtectedLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
