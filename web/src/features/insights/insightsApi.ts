import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'

export type RiskLevel = 'High' | 'Medium' | 'Low'

export interface StudentRisk {
  studentId: string; name: string; indexNo: string | null; courseId: number; courseName: string
  riskScore: number; level: RiskLevel; avgGrade: number | null; graded: number; missing: number; late: number; submitted: number; dueSoFar: number
  quizAvg: number | null; completion: number; daysSinceAccess: number | null; blocked: boolean; paymentDue: boolean
  reasons: string[]; actions: string[]; gradeTrend: number[]
}

export interface AtRiskResponse {
  courses: { id: number; name: string }[]
  students: StudentRisk[]
  summary: { high: number; medium: number; low: number; avgGrade: number; missing: number; topReasons: { reason: string; count: number }[] }
  distribution: { band: string; count: number }[]
}

export interface MyInsights {
  riskScore: number; level: RiskLevel
  courses: { courseId: number; courseName: string; riskScore: number; level: RiskLevel; avgGrade: number | null; missing: number; late: number; quizAvg: number | null; completion: number; reasons: string[]; gradeTrend: number[] }[]
  tips: string[]
}

export const useAtRisk = (enabled = true) =>
  useQuery({ queryKey: ['at-risk'], queryFn: async () => (await api.get<AtRiskResponse>('/api/v1/analytics/at-risk')).data, enabled, staleTime: 30_000 })

export const useMyInsights = (enabled = true) =>
  useQuery({ queryKey: ['my-insights'], queryFn: async () => (await api.get<MyInsights>('/api/v1/analytics/me')).data, enabled, staleTime: 30_000 })

export const useRefreshInsights = () => {
  const qc = useQueryClient()
  return () => { void qc.invalidateQueries({ queryKey: ['at-risk'] }); void qc.invalidateQueries({ queryKey: ['my-insights'] }) }
}

export const notifyStudent = (studentId: string, courseId: number, message: string) => api.post('/api/v1/analytics/notify', { studentId, courseId, message })

export const LEVEL_TONE: Record<RiskLevel, { badge: string; color: string }> = {
  High: { badge: 'badge-red', color: 'var(--color-red)' },
  Medium: { badge: 'badge-amber', color: 'var(--color-amber)' },
  Low: { badge: 'badge-green', color: 'var(--color-green)' },
}
