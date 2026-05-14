import { useQuery } from '@tanstack/react-query'
import api from '../api/api'
import { useFilters } from '../context/FilterContext'

const STALE_5M = 5 * 60 * 1000
const STALE_30M = 30 * 60 * 1000

function useFetchWithFilters(key, endpoint, options = {}) {
  const { queryParams } = useFilters()
  return useQuery({
    queryKey: [key, queryParams],
    queryFn: () => api.get(endpoint, { params: queryParams }).then(r => r.data),
    staleTime: STALE_5M,
    placeholderData: (prev) => prev,
    ...options,
  })
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/api/employees').then(r => r.data),
    staleTime: STALE_30M,
  })
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.get('/api/sync/status').then(r => r.data),
    staleTime: STALE_5M,
  })
}

export function useDashboard() {
  return useFetchWithFilters('dashboard', '/api/dashboard')
}

export function useActivity() {
  return useFetchWithFilters('activity', '/api/activity')
}

export function useConnections() {
  return useFetchWithFilters('connections', '/api/connections')
}

export function useFollowUps() {
  return useFetchWithFilters('followups', '/api/followups')
}

export function useInMails() {
  return useFetchWithFilters('inmails', '/api/inmails')
}

export function usePositiveResponses() {
  return useFetchWithFilters('positive-responses', '/api/positive-responses')
}

export function useLeads() {
  return useFetchWithFilters('leads', '/api/leads')
}

export function useDrilldown(metric) {
  const { queryParams } = useFilters()
  return useQuery({
    queryKey: ['drilldown', metric, queryParams],
    queryFn: () => api.get(`/api/drilldown/${metric}`, { params: queryParams }).then(r => r.data),
    enabled: !!metric,
    staleTime: STALE_5M,
    placeholderData: (prev) => prev,
  })
}
