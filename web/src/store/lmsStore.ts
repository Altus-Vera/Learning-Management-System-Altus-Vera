import { create } from 'zustand'
import { api } from '../services/api'
import { call } from '../services/sync'

export type ActivityType = 'assign' | 'resource' | 'forum' | 'quiz' | 'url' | 'folder' | 'choice' | 'feedback' | 'page' | 'label'

export interface QuizSettings {
  openDate: string | null
  closeDate: string | null
  timeLimitMins: number
  attemptsAllowed: number
  gradingMethod: 'Highest grade' | 'Average grade' | 'First attempt' | 'Last attempt'
  maxGrade: number
  reviewAfterClose: boolean
}

export interface AssignSettings {
  allowSubmissionsFrom: string | null
  dueDate: string | null
  cutOffDate: string | null
  remindToGradeBy: string | null
  acceptingSubmissions: boolean
  fileSubmissions: boolean
  onlineText: boolean
  maxFiles: number
  maxSizeMb: number
  acceptedTypes: string
  requireSubmitButton: boolean
  maxGrade: number
}

export interface SubmissionFile { id?: number; name: string; size: number; uploadedAt: string; downloadable?: boolean }

export interface Submission {
  studentId: string
  status: 'new' | 'draft' | 'submitted'
  files: SubmissionFile[]
  onlineText: string
  modifiedAt: string | null
  grade: number | null
  feedback: string
  gradedAt: string | null
}

export interface Activity {
  id: number
  type: ActivityType
  name: string
  description?: string
  visible: boolean
  assign?: AssignSettings
  quiz?: QuizSettings
  content?: string
}

export interface Section { id: number; title: string; summary?: string; activities: Activity[] }

export interface Course {
  id: number
  shortName: string
  fullName: string
  category: string
  term: string
  color: string
  lecturer: string
  lecturerId?: string
  starred: boolean
  hidden: boolean
  lastAccess: string
  sections: Section[]
}

export interface Student { id: string; name: string; email: string }

export interface LmsEvent { id: number; title: string; date: string; courseId?: number; type: 'due' | 'user' | 'course' | 'site' }

/** Students visible to the signed-in user; filled from the server on every data load. */
export const STUDENTS: Student[] = []

/** The signed-in user's id; set from the server before any view renders data. */
export let CURRENT_STUDENT_ID = ''
export const setCurrentUserId = (id: string) => { CURRENT_STUDENT_ID = id }

export const quizDefaults = (p: Partial<QuizSettings> = {}): QuizSettings => ({
  openDate: null, closeDate: null, timeLimitMins: 30, attemptsAllowed: 1, gradingMethod: 'Highest grade', maxGrade: 10, reviewAfterClose: true, ...p,
})

interface LmsState {
  courses: Course[]
  submissions: Record<string, Submission>
  completion: Record<string, boolean>
  events: LmsEvent[]
  editMode: boolean
  setEditMode: (v: boolean) => void
  toggleStar: (courseId: number) => void
  toggleHidden: (courseId: number) => void
  touchCourse: (courseId: number) => void
  toggleCompletion: (activityId: number) => void
  setActivityVisible: (activityId: number, visible: boolean) => void
  renameActivity: (activityId: number, name: string) => void
  deleteActivity: (activityId: number) => void
  addActivity: (courseId: number, sectionId: number, type: ActivityType, name: string) => void
  updateAssign: (activityId: number, patch: Partial<AssignSettings>) => void
  updateActivity: (activityId: number, patch: Partial<Activity>) => void
  gradeSubmission: (activityId: number, studentId: string, grade: number | null, feedback: string) => void
  setSubmissionStatus: (activityId: number, studentId: string, status: Submission['status']) => void
  addEvent: (e: Omit<LmsEvent, 'id'>) => void
  deleteEvent: (id: number) => void
}

const mapActivity = (courses: Course[], id: number, fn: (a: Activity) => Activity | null): Course[] =>
  courses.map((c) => ({
    ...c,
    sections: c.sections.map((s) => ({ ...s, activities: s.activities.flatMap((a) => { if (a.id !== id) return [a]; const r = fn(a); return r ? [r] : [] }) })),
  }))

export const useLmsStore = create<LmsState>()((set, get) => ({
  courses: [],
  submissions: {},
  completion: {},
  events: [],
  editMode: false,
  setEditMode: (editMode) => set({ editMode }),

  toggleStar: (id) => {
    const starred = !get().courses.find((c) => c.id === id)?.starred
    set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, starred } : c)) }))
    void call(() => api.put(`/api/v1/courses/${id}/state`, { starred, touch: false }), { reload: false })
  },
  toggleHidden: (id) => {
    const hidden = !get().courses.find((c) => c.id === id)?.hidden
    set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, hidden } : c)) }))
    void call(() => api.put(`/api/v1/courses/${id}/state`, { hidden, touch: false }), { reload: false })
  },
  touchCourse: (id) => {
    set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, lastAccess: new Date().toISOString() } : c)) }))
    void api.put(`/api/v1/courses/${id}/state`, { touch: true }).catch(() => undefined)
  },
  toggleCompletion: (id) => {
    set((s) => ({ completion: { ...s.completion, [id]: !s.completion[id] } }))
    void call(() => api.post(`/api/v1/activities/${id}/completion`), { reload: false })
  },
  setActivityVisible: (id, visible) => {
    set((s) => ({ courses: mapActivity(s.courses, id, (a) => ({ ...a, visible })) }))
    void call(() => api.put(`/api/v1/activities/${id}`, { visible }))
  },
  renameActivity: (id, name) => {
    set((s) => ({ courses: mapActivity(s.courses, id, (a) => ({ ...a, name })) }))
    void call(() => api.put(`/api/v1/activities/${id}`, { name }))
  },
  deleteActivity: (id) => {
    set((s) => ({ courses: mapActivity(s.courses, id, () => null) }))
    void call(() => api.delete(`/api/v1/activities/${id}`))
  },
  addActivity: (_courseId, sectionId, type, name) => {
    void call(() => api.post(`/api/v1/sections/${sectionId}/activities`, { type, name }))
  },
  updateAssign: (id, patch) => {
    let next: AssignSettings | undefined
    set((s) => ({ courses: mapActivity(s.courses, id, (a) => { next = { ...a.assign!, ...patch }; return { ...a, assign: next } }) }))
    if (next) void call(() => api.put(`/api/v1/activities/${id}`, { assign: next }))
  },
  updateActivity: (id, patch) => {
    set((s) => ({ courses: mapActivity(s.courses, id, (a) => ({ ...a, ...patch })) }))
    const body: Record<string, unknown> = {}
    if (patch.name !== undefined) body.name = patch.name
    if (patch.description !== undefined) body.description = patch.description
    if (patch.content !== undefined) body.content = patch.content
    if (patch.visible !== undefined) body.visible = patch.visible
    if (patch.quiz !== undefined) body.quiz = patch.quiz
    if (patch.assign !== undefined) body.assign = patch.assign
    void call(() => api.put(`/api/v1/activities/${id}`, body))
  },
  gradeSubmission: (id, studentId, grade, feedback) => {
    set((s) => {
      const key = `${id}:${studentId}`
      const prev = s.submissions[key] ?? { studentId, status: 'new' as const, files: [], onlineText: '', modifiedAt: null, grade: null, feedback: '', gradedAt: null }
      return { submissions: { ...s.submissions, [key]: { ...prev, grade, feedback, gradedAt: new Date().toISOString() } } }
    })
    void call(() => api.put(`/api/v1/assignments/${id}/submissions/${studentId}/grade`, { grade, feedback }))
  },
  setSubmissionStatus: (id, studentId, status) => {
    void call(() => api.put(`/api/v1/assignments/${id}/submissions/${studentId}/status`, { status }))
  },
  addEvent: (e) => {
    void call(() => api.post('/api/v1/calendar/events', { title: e.title, date: e.date, type: e.type, courseId: e.courseId ?? null }))
  },
  deleteEvent: (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
    void call(() => api.delete(`/api/v1/calendar/events/${id}`))
  },
}))

export const findActivity = (courses: Course[], id: number) => {
  for (const c of courses) for (const s of c.sections) for (const a of s.activities) if (a.id === id) return { course: c, section: s, activity: a }
  return null
}

export const courseProgress = (course: Course, completion: Record<string, boolean>) => {
  const all = course.sections.flatMap((s) => s.activities.filter((a) => a.visible && a.type !== 'label'))
  if (!all.length) return 0
  return Math.round((all.filter((a) => completion[a.id]).length / all.length) * 100)
}

export type AssignPhase = 'not-open' | 'open' | 'overdue' | 'closed' | 'disabled'

export const assignPhase = (a: AssignSettings, now = new Date()): AssignPhase => {
  if (!a.acceptingSubmissions) return 'disabled'
  if (a.allowSubmissionsFrom && now < new Date(a.allowSubmissionsFrom)) return 'not-open'
  if (a.cutOffDate && now > new Date(a.cutOffDate)) return 'closed'
  if (a.dueDate && now > new Date(a.dueDate)) return 'overdue'
  return 'open'
}
