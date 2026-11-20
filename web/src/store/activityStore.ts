import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './authStore'
import { useUiStore } from './uiStore'
import { CURRENT_STUDENT_ID } from './lmsStore'

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

const ago = (days: number, h = 10) => { const t = new Date(); t.setDate(t.getDate() - days); t.setHours(h, 15, 0, 0); return t.toISOString() }

const once = <T,>(fn: () => T) => { let v: T | undefined; return () => (v ??= fn()) }
const seedNews = once((): Discussion[] => buildDiscussions(true))
const seedDisc = once((): Discussion[] => buildDiscussions(false))
export const seedDiscussions = (news: boolean) => (news ? seedNews() : seedDisc())
const buildDiscussions = (news: boolean): Discussion[] => news ? [
  { id: 1, subject: 'Lecture rescheduled to Friday', authorId: 'l1', author: 'Module Lecturer', createdAt: ago(2), pinned: true, locked: false, posts: [{ id: 11, parentId: null, authorId: 'l1', author: 'Module Lecturer', message: 'This week’s lecture will be held on Friday at 10:00 AM in Hall C2-004 instead of Monday.', at: ago(2) }] },
  { id: 2, subject: 'Assignment groups are final', authorId: 'l1', author: 'Module Lecturer', createdAt: ago(6), pinned: false, locked: true, posts: [{ id: 21, parentId: null, authorId: 'l1', author: 'Module Lecturer', message: 'The group list is now final. All groups must have members registered through the group choice activity.', at: ago(6) }] },
] : [
  { id: 3, subject: 'Clarification on Tutorial 05 question 3', authorId: 's2', author: 'GPAD Nilwala', createdAt: ago(3, 14), pinned: false, locked: false, posts: [
    { id: 31, parentId: null, authorId: 's2', author: 'GPAD Nilwala', message: 'For question 3, should we use the 2023 annual report or the latest one?', at: ago(3, 14) },
    { id: 32, parentId: 31, authorId: 'l1', author: 'Module Lecturer', message: 'Use the latest annual report available on the company website.', at: ago(3, 16) },
    { id: 33, parentId: 32, authorId: 's3', author: 'KWKS Wijerathna', message: 'Thank you! That clears it up.', at: ago(2, 9) },
  ] },
  { id: 4, subject: 'Study group for the final exam', authorId: 's4', author: 'TDJ Pathirana', createdAt: ago(1, 18), pinned: false, locked: false, posts: [{ id: 41, parentId: null, authorId: 's4', author: 'TDJ Pathirana', message: 'Anyone interested in a weekend study group at the library? Reply below.', at: ago(1, 18) }] },
]

const FAKE = ['Balasooriya S', 'Fernando TPR', 'Kodithuwakku RPK', 'Sheriffdeen MAH', 'Ariyathilaka DBN', 'Chandrasiri DMH', 'Iniyan M', 'Karunanayake AS', 'Rashmika GDT', 'Rathnayaka CKM', 'Weerasena OVD', 'Ahmed YAR', 'Dissanayaka MIB', 'Lakmali PLA', 'Premarathna GTK', 'Ranwella GKM']
export const seedGroups = once((): ChoiceGroup[] => [
  { id: 1, name: 'Group A', description: 'Topic: Corporate strategy of a listed company', capacity: 5, members: [FAKE[0], FAKE[1], FAKE[2], FAKE[3], FAKE[4]] },
  { id: 2, name: 'Group B', description: 'Topic: Competitive strategy in the telecom sector', capacity: 5, members: [FAKE[5], FAKE[6], FAKE[7]] },
  { id: 3, name: 'Group C', description: 'Topic: Strategy implementation in SMEs', capacity: 5, members: [FAKE[8], FAKE[9]] },
  { id: 4, name: 'Group D', description: 'Topic: Digital transformation strategy', capacity: 5, members: [FAKE[10]] },
])

interface ActivityState {
  forums: Record<number, Discussion[]>
  subscriptions: Record<number, boolean>
  starredDiscussions: Record<number, boolean>
  attempts: Record<number, QuizAttempt[]>
  feedback: Record<number, FeedbackResponse[]>
  feedbackDone: Record<string, boolean>
  groups: Record<number, ChoiceGroup[]>
  comments: Record<string, Comment[]>

  discussions: (forumId: number, news: boolean) => Discussion[]
  addDiscussion: (forumId: number, news: boolean, subject: string, message: string, pinned: boolean) => void
  reply: (forumId: number, news: boolean, discussionId: number, parentId: number, message: string) => void
  editPost: (forumId: number, discussionId: number, postId: number, message: string) => void
  deletePost: (forumId: number, discussionId: number, postId: number) => void
  setDiscussionFlag: (forumId: number, discussionId: number, flag: 'pinned' | 'locked', v: boolean) => void
  deleteDiscussion: (forumId: number, discussionId: number) => void
  toggleSubscription: (forumId: number) => void
  toggleStarDiscussion: (discussionId: number) => void

  startAttempt: (quizId: number, userId: string) => QuizAttempt
  finishAttempt: (quizId: number, attemptId: number, answers: Record<number, number>) => void

  submitFeedback: (feedbackId: number, userId: string, answers: Record<string, number | string>) => void

  groupsFor: (choiceId: number) => ChoiceGroup[]
  joinGroup: (choiceId: number, groupId: number | null, member: string) => void

  addComment: (key: string, authorId: string, author: string, text: string) => void
  deleteComment: (key: string, id: number) => void
}

export const seedFeedback = once((): FeedbackResponse[] => Array.from({ length: 14 }, (_, i) => ({
  at: ago(i + 1),
  answers: { q1: 3 + (i % 3 === 0 ? 1 : i % 2), q2: 3 + (i % 2), q3: 4 + (i % 4 === 0 ? 0 : 1) - (i % 5 === 0 ? 1 : 0), q4: 2 + (i % 3), q5: 3 + (i % 3 === 1 ? 2 : i % 2), q6: i % 4 === 0 ? 'More practical examples would help.' : '' },
})))

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => {
      const forumOf = (id: number, news: boolean) => get().forums[id] ?? seedDiscussions(news)
      const setForum = (id: number, list: Discussion[]) => set((s) => ({ forums: { ...s.forums, [id]: list } }))
      const mapDisc = (forumId: number, discId: number, fn: (d: Discussion) => Discussion) => setForum(forumId, (get().forums[forumId] ?? []).map((d) => (d.id === discId ? fn(d) : d)))
      return {
        forums: {}, subscriptions: {}, starredDiscussions: {}, attempts: {}, feedback: {}, feedbackDone: {}, groups: {}, comments: {},
        discussions: (id, news) => forumOf(id, news),
        addDiscussion: (id, news, subject, message, pinned) => {
          const me = currentUser()
          const now = new Date().toISOString(); const did = Date.now()
          setForum(id, [{ id: did, subject, authorId: me.id, author: me.name, createdAt: now, pinned, locked: false, posts: [{ id: did + 1, parentId: null, authorId: me.id, author: me.name, message, at: now }] }, ...forumOf(id, news)])
        },
        reply: (id, news, discId, parentId, message) => {
          const me = currentUser()
          if (!get().forums[id]) setForum(id, forumOf(id, news))
          mapDisc(id, discId, (d) => ({ ...d, posts: [...d.posts, { id: Date.now(), parentId, authorId: me.id, author: me.name, message, at: new Date().toISOString() }] }))
        },
        editPost: (id, discId, postId, message) => mapDisc(id, discId, (d) => ({ ...d, posts: d.posts.map((p) => (p.id === postId ? { ...p, message } : p)) })),
        deletePost: (id, discId, postId) => mapDisc(id, discId, (d) => ({ ...d, posts: d.posts.filter((p) => p.id !== postId && p.parentId !== postId) })),
        setDiscussionFlag: (id, discId, flag, v) => mapDisc(id, discId, (d) => ({ ...d, [flag]: v })),
        deleteDiscussion: (id, discId) => setForum(id, (get().forums[id] ?? []).filter((d) => d.id !== discId)),
        toggleSubscription: (id) => set((s) => ({ subscriptions: { ...s.subscriptions, [id]: !s.subscriptions[id] } })),
        toggleStarDiscussion: (id) => set((s) => ({ starredDiscussions: { ...s.starredDiscussions, [id]: !s.starredDiscussions[id] } })),

        startAttempt: (quizId, userId) => {
          const a: QuizAttempt = { id: Date.now(), userId, startedAt: new Date().toISOString(), finishedAt: null, answers: {}, score: null }
          set((s) => ({ attempts: { ...s.attempts, [quizId]: [...(s.attempts[quizId] ?? []), a] } }))
          return a
        },
        finishAttempt: (quizId, attemptId, answers) => set((s) => ({
          attempts: { ...s.attempts, [quizId]: (s.attempts[quizId] ?? []).map((a) => a.id !== attemptId ? a : { ...a, answers, finishedAt: new Date().toISOString(), score: QUIZ_QUESTIONS.filter((q, i) => answers[i] === q.a).length }) },
        })),

        submitFeedback: (id, userId, answers) => set((s) => ({
          feedback: { ...s.feedback, [id]: [...(s.feedback[id] ?? seedFeedback()), { at: new Date().toISOString(), answers }] },
          feedbackDone: { ...s.feedbackDone, [`${id}:${userId}`]: true },
        })),

        groupsFor: (id) => get().groups[id] ?? seedGroups(),
        joinGroup: (id, groupId, member) => set((s) => ({
          groups: { ...s.groups, [id]: (s.groups[id] ?? seedGroups()).map((g) => ({ ...g, members: g.id === groupId ? [...g.members.filter((m) => m !== member), member] : g.members.filter((m) => m !== member) })) },
        })),

        addComment: (key, authorId, author, text) => set((s) => ({ comments: { ...s.comments, [key]: [...(s.comments[key] ?? []), { id: Date.now(), authorId, author, text, at: new Date().toISOString() }] } })),
        deleteComment: (key, id) => set((s) => ({ comments: { ...s.comments, [key]: (s.comments[key] ?? []).filter((c) => c.id !== id) } })),
      }
    },
    { name: 'lms-activity-v1' },
  ),
)

export const feedbackResponses = (state: ActivityState, id: number) => state.feedback[id] ?? seedFeedback()

export function currentUser() {
  const u = useAuthStore.getState().user
  const role = u?.role ?? 'Student'
  const teacher = (role === 'Lecturer' || role === 'Admin') && !useUiStore.getState().viewAsStudent
  return { id: teacher ? 'l1' : CURRENT_STUDENT_ID, name: u?.fullName ?? 'User', teacher }
}

export function useMe() {
  const u = useAuthStore((s) => s.user)
  const viewAsStudent = useUiStore((s) => s.viewAsStudent)
  const teacher = (u?.role === 'Lecturer' || u?.role === 'Admin') && !viewAsStudent
  return { id: teacher ? 'l1' : CURRENT_STUDENT_ID, name: u?.fullName ?? 'User', teacher }
}
