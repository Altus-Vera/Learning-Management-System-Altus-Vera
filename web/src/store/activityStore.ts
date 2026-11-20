import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { useUiStore } from './uiStore'
import { api } from '../services/api'
import { call } from '../services/sync'

export interface ForumPost { id: number; parentId: number | null; authorId: string; author: string; message: string; at: string }
export interface Discussion { id: number; subject: string; authorId: string; author: string; createdAt: string; pinned: boolean; locked: boolean; posts: ForumPost[] }
export interface QuizAttempt { id: number; userId: string; startedAt: string; finishedAt: string | null; answers: Record<number, number>; score: number | null }
export interface FeedbackResponse { at: string; answers: Record<string, number | string> }
export interface ChoiceGroup { id: number; name: string; description: string; capacity: number; members: string[] }
export interface Comment { id: number; authorId: string; author: string; text: string; at: string }

export const QUIZ_QUESTIONS = [
  { q: 'Which of the following best describes a SWOT analysis?', o: ['A financial forecasting model', 'An assessment of strengths, weaknesses, opportunities and threats', 'A pricing strategy', 'A marketing channel'], a: 1 },
  { q: 'Porter’s Five Forces is primarily used to analyse…', o: ['Industry competitiveness', 'Employee motivation', 'Cash flow', 'Product design'], a: 0 },
  { q: 'A mission statement describes…', o: ['Quarterly targets', 'The organisation’s fundamental purpose', 'Tax obligations', 'Board composition'], a: 1 },
  { q: 'Which strategy focuses on offering products at the lowest cost in the industry?', o: ['Differentiation', 'Focus', 'Cost leadership', 'Diversification'], a: 2 },
  { q: 'PESTEL analysis examines the…', o: ['Internal resources', 'External macro environment', 'Competitor pricing', 'Supply chain costs'], a: 1 },
]

export const FEEDBACK_QUESTIONS = [
  { id: 'q1', text: 'The lecturer explained the subject matter clearly.', type: 'rating' as const },
  { id: 'q2', text: 'The lecture materials were useful and well organised.', type: 'rating' as const },
  { id: 'q3', text: 'The lecturer was punctual and well prepared.', type: 'rating' as const },
  { id: 'q4', text: 'Assessments were relevant to the module content.', type: 'rating' as const },
  { id: 'q5', text: 'Overall, I am satisfied with this module.', type: 'rating' as const },
  { id: 'q6', text: 'Any other comments or suggestions?', type: 'text' as const },
]
export const RATING_LABELS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']

const NO_DISCUSSIONS: Discussion[] = []
const NO_GROUPS: ChoiceGroup[] = []
const NO_FEEDBACK: FeedbackResponse[] = []
export const seedDiscussions = (_news: boolean) => NO_DISCUSSIONS
export const seedGroups = () => NO_GROUPS
export const seedFeedback = () => NO_FEEDBACK

interface ActivityState {
  forums: Record<number, Discussion[]>
  subscriptions: Record<number, boolean>
  starredDiscussions: Record<number, boolean>
  attempts: Record<number, QuizAttempt[]>
  feedback: Record<number, FeedbackResponse[]>
  feedbackDone: Record<string, boolean>
  groups: Record<number, ChoiceGroup[]>
  comments: Record<string, Comment[]>

  addDiscussion: (forumId: number, news: boolean, subject: string, message: string, pinned: boolean) => void
  reply: (forumId: number, news: boolean, discussionId: number, parentId: number, message: string) => void
  editPost: (forumId: number, discussionId: number, postId: number, message: string) => void
  deletePost: (forumId: number, discussionId: number, postId: number) => void
  setDiscussionFlag: (forumId: number, discussionId: number, flag: 'pinned' | 'locked', v: boolean) => void
  deleteDiscussion: (forumId: number, discussionId: number) => void
  toggleSubscription: (forumId: number) => void
  toggleStarDiscussion: (discussionId: number) => void

  startAttempt: (quizId: number) => Promise<QuizAttempt | undefined>
  finishAttempt: (quizId: number, attemptId: number, answers: Record<number, number>) => Promise<void>

  submitFeedback: (feedbackId: number, answers: Record<string, number | string>) => Promise<boolean>
  joinGroup: (choiceId: number, groupId: number | null) => Promise<boolean>

  addComment: (activityId: number, studentId: string, text: string) => void
  deleteComment: (key: string, id: number) => void
}

export const useActivityStore = create<ActivityState>()((set) => ({
  forums: {}, subscriptions: {}, starredDiscussions: {}, attempts: {}, feedback: {}, feedbackDone: {}, groups: {}, comments: {},

  addDiscussion: (forumId, _news, subject, message, pinned) => { void call(() => api.post(`/api/v1/forums/${forumId}/discussions`, { subject, message, pinned })) },
  reply: (_forumId, _news, discussionId, parentId, message) => { void call(() => api.post(`/api/v1/discussions/${discussionId}/posts`, { parentId, message })) },
  editPost: (_f, _d, postId, message) => { void call(() => api.put(`/api/v1/posts/${postId}`, { message })) },
  deletePost: (_f, _d, postId) => { void call(() => api.delete(`/api/v1/posts/${postId}`)) },
  setDiscussionFlag: (_f, discussionId, flag, v) => { void call(() => api.put(`/api/v1/discussions/${discussionId}`, { [flag]: v })) },
  deleteDiscussion: (_f, discussionId) => { void call(() => api.delete(`/api/v1/discussions/${discussionId}`)) },
  toggleSubscription: (forumId) => {
    set((s) => ({ subscriptions: { ...s.subscriptions, [forumId]: !s.subscriptions[forumId] } }))
    void call(() => api.post(`/api/v1/forums/${forumId}/subscription`))
  },
  toggleStarDiscussion: (id) => {
    set((s) => ({ starredDiscussions: { ...s.starredDiscussions, [id]: !s.starredDiscussions[id] } }))
    void call(() => api.post(`/api/v1/discussions/${id}/star`), { reload: false })
  },

  startAttempt: async (quizId) => {
    const res = await call(() => api.post<QuizAttempt>(`/api/v1/quizzes/${quizId}/attempts`), { reload: false })
    return res?.data
  },
  finishAttempt: async (_quizId, attemptId, answers) => {
    await call(() => api.post(`/api/v1/quiz-attempts/${attemptId}/finish`, { answers }))
  },

  submitFeedback: async (feedbackId, answers) => !!(await call(() => api.post(`/api/v1/feedback/${feedbackId}/responses`, answers))),
  joinGroup: async (choiceId, groupId) => !!(await call(() => api.post(`/api/v1/choices/${choiceId}/join`, { groupId }))),

  addComment: (activityId, studentId, text) => { void call(() => api.post(`/api/v1/assignments/${activityId}/comments`, { studentId, text })) },
  deleteComment: (_key, id) => { void call(() => api.delete(`/api/v1/submission-comments/${id}`)) },
}))

export const feedbackResponses = (state: ActivityState, id: number) => state.feedback[id] ?? NO_FEEDBACK

export function currentUser() {
  const u = useAuthStore.getState().user
  const role = u?.role ?? 'Student'
  const teacher = (role === 'Lecturer' || role === 'Admin') && !useUiStore.getState().viewAsStudent
  return { id: u?.userId ?? '', name: u?.fullName ?? 'User', teacher }
}

export function useMe() {
  const u = useAuthStore((s) => s.user)
  const viewAsStudent = useUiStore((s) => s.viewAsStudent)
  const teacher = (u?.role === 'Lecturer' || u?.role === 'Admin') && !viewAsStudent
  return { id: u?.userId ?? '', name: u?.fullName ?? 'User', teacher }
}
