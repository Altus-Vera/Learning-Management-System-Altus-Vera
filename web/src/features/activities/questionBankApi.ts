import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'

export interface BankQuestion { id: number; category: string; text: string; options: string[]; correctIndex: number; explanation: string | null; createdBy: string; createdAt: string }
export interface PaperQuestion { id: number; text: string; options: string[] }
export interface ReviewQuestion extends PaperQuestion { chosen: number; correct: number; explanation: string | null }
export interface AttemptReview { id: number; startedAt: string; finishedAt: string | null; score: number | null; maxScore: number; questions: ReviewQuestion[] }
export interface ItemData {
  questions: { id: number; text: string; category: string; options: string[]; correctIndex: number }[]
  attempts: { id: number; userId: string; score: number | null; maxScore: number; questionIds: number[]; answers: Record<string, number> }[]
}

export const useQuestionBank = (courseId: number | undefined, enabled = true) =>
  useQuery({ queryKey: ['bank', courseId], queryFn: async () => (await api.get<BankQuestion[]>(`/api/v1/courses/${courseId}/questions`)).data, enabled: enabled && !!courseId })

export const useInvalidateBank = () => { const qc = useQueryClient(); return (courseId: number) => qc.invalidateQueries({ queryKey: ['bank', courseId] }) }

export const saveQuestion = (courseId: number, q: { id?: number; category: string; text: string; options: string[]; correctIndex: number; explanation: string }) =>
  q.id ? api.put(`/api/v1/courses/${courseId}/questions/${q.id}`, q) : api.post(`/api/v1/courses/${courseId}/questions`, q)
export const deleteQuestion = (id: number) => api.delete(`/api/v1/questions/${id}`)
export const importQuestions = (courseId: number, category: string, text: string) => api.post<{ imported: number }>(`/api/v1/courses/${courseId}/questions/import`, { category, text })
export const getReview = async (attemptId: number) => (await api.get<AttemptReview>(`/api/v1/quiz-attempts/${attemptId}`)).data
export const useItemData = (quizId: number, enabled = true) =>
  useQuery({ queryKey: ['item-data', quizId], queryFn: async () => (await api.get<ItemData>(`/api/v1/quizzes/${quizId}/item-data`)).data, enabled })
