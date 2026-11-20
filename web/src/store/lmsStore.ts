import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ActivityType = 'assign' | 'resource' | 'forum' | 'quiz' | 'url' | 'folder' | 'choice'

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

export interface SubmissionFile { name: string; size: number; uploadedAt: string }

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
  starred: boolean
  hidden: boolean
  lastAccess: string
  sections: Section[]
}

export interface Student { id: string; name: string; email: string }

export interface LmsEvent { id: number; title: string; date: string; courseId?: number; type: 'due' | 'user' | 'course' | 'site' }

const d = (offsetDays: number, h = 23, m = 59) => {
  const t = new Date()
  t.setDate(t.getDate() + offsetDays)
  t.setHours(h, m, 0, 0)
  return t.toISOString()
}

const assign = (p: Partial<AssignSettings>): AssignSettings => ({
  allowSubmissionsFrom: d(-14, 0, 0),
  dueDate: d(7),
  cutOffDate: d(9),
  remindToGradeBy: d(14),
  acceptingSubmissions: true,
  fileSubmissions: true,
  onlineText: false,
  maxFiles: 1,
  maxSizeMb: 20,
  acceptedTypes: '.pdf,.docx,.pptx,.zip',
  requireSubmitButton: true,
  maxGrade: 100,
  ...p,
})

let aid = 1000
const notes = (n: number, visibleUpTo: number): Activity[] =>
  Array.from({ length: n }, (_, i) => ({
    id: aid++,
    type: 'resource' as const,
    name: `Lecture Note ${String(i + 1).padStart(2, '0')}`,
    visible: i < visibleUpTo,
  }))

const tutorials = (n: number, start: number): Activity[] =>
  Array.from({ length: n }, (_, i) => ({
    id: aid++,
    type: 'assign' as const,
    name: `Tutorial ${String(i + 1).padStart(2, '0')}`,
    description: `Answer all questions in Tutorial ${i + 1} and upload a single PDF. Handwritten answers must be scanned clearly.`,
    visible: true,
    assign: assign({ dueDate: d(start + i * 7), cutOffDate: d(start + i * 7 + 2), allowSubmissionsFrom: d(start + i * 7 - 7, 0, 0) }),
  }))

const buildSections = (code: string): Section[] => [
  {
    id: 1, title: 'General', summary: 'Course announcements and module information.',
    activities: [
      { id: aid++, type: 'forum', name: 'Announcements', visible: true, description: 'General news and announcements from the module lecturer.' },
      { id: aid++, type: 'resource', name: `${code} Module Outline`, visible: true },
      { id: aid++, type: 'url', name: 'Recorded Lectures (MS Teams)', visible: true },
    ],
  },
  { id: 2, title: 'Lecture Notes', activities: notes(10, 8) },
  { id: 3, title: 'Tutorials', activities: tutorials(10, -42) },
  {
    id: 4, title: 'Assignment', summary: 'Group assignment — 40% of the final mark.',
    activities: [
      { id: aid++, type: 'resource', name: 'Assignment Description', visible: true },
      { id: aid++, type: 'choice', name: 'Assignment Group Enrollment', visible: true },
      { id: aid++, type: 'assign', name: 'Assignment Presentation Slides', visible: true, description: 'Upload your group presentation slides (PPTX or PDF).', assign: assign({ dueDate: d(-3), cutOffDate: d(-1), maxFiles: 2, acceptedTypes: '.pptx,.pdf' }) },
      { id: aid++, type: 'assign', name: 'Assignment Final Report Submission', visible: true, description: 'Submit the final report. Turnitin similarity must be below 20%.', assign: assign({ dueDate: d(10), cutOffDate: d(12), maxSizeMb: 50 }) },
    ],
  },
  { id: 5, title: 'Quizzes', activities: [{ id: aid++, type: 'quiz', name: 'Mid-term Quiz', visible: true, description: '20 MCQ questions · 30 minutes · 1 attempt' }] },
  { id: 6, title: 'Topic 6', activities: [] },
]

const COURSES: Omit<Course, 'sections'>[] = [
  { id: 13195, shortName: 'BS401.3', fullName: 'Business Policy and Strategy', category: 'Faculty of Business', term: 'Year 4 — Semester 1', color: '#0033A0', lecturer: 'Dr. K. Perera', starred: true, hidden: false, lastAccess: d(0, 9, 0) },
  { id: 13210, shortName: 'CS404.3', fullName: 'Parallel and Distributed Computing', category: 'Faculty of Computing', term: 'Year 4 — Semester 2', color: '#0D9488', lecturer: 'Mr. S. Fernando', starred: false, hidden: false, lastAccess: d(-1, 15, 0) },
  { id: 13188, shortName: 'PR400', fullName: 'Special Award Project', category: 'Faculty of Computing', term: 'Year 4 — Semester 1', color: '#7C3AED', lecturer: 'Prof. N. Silva', starred: false, hidden: false, lastAccess: d(-2, 11, 0) },
  { id: 13201, shortName: 'SE402.3', fullName: 'Software Quality Assurance', category: 'Faculty of Computing', term: 'Year 4 — Semester 1', color: '#DB2777', lecturer: 'Ms. A. Jayasinghe', starred: false, hidden: false, lastAccess: d(-4, 10, 0) },
  { id: 13177, shortName: 'MG403.3', fullName: 'Entrepreneurship and Innovation', category: 'Faculty of Business', term: 'Year 4 — Semester 1', color: '#EA580C', lecturer: 'Dr. R. Wickrama', starred: false, hidden: false, lastAccess: d(-6, 14, 0) },
  { id: 12950, shortName: 'CS301.3', fullName: 'Computer Networks', category: 'Faculty of Computing', term: 'Year 3 — Semester 2', color: '#0891B2', lecturer: 'Mr. P. Bandara', starred: false, hidden: false, lastAccess: d(-90, 10, 0) },
]

export const STUDENTS: Student[] = [
  { id: 's1', name: 'DVD Silva', email: 'dvdsilva@students.altusvera.lk' },
  { id: 's2', name: 'GPAD Nilwala', email: 'gpadnilwala@students.altusvera.lk' },
  { id: 's3', name: 'KWKS Wijerathna', email: 'kwkswijerathna@students.altusvera.lk' },
  { id: 's4', name: 'TDJ Pathirana', email: 'tdjpathirana@students.altusvera.lk' },
  { id: 's5', name: 'HN Kanakarathne', email: 'hnkanakarathne@students.altusvera.lk' },
  { id: 's6', name: 'MAS Perera', email: 'masperera@students.altusvera.lk' },
]

export const CURRENT_STUDENT_ID = 's1'

const seedSubmissions = (courses: Course[]): Record<string, Submission> => {
  const out: Record<string, Submission> = {}
  courses.forEach((c) =>
    c.sections.forEach((s) =>
      s.activities.forEach((a, ai) => {
        if (a.type !== 'assign') return
        const due = new Date(a.assign!.dueDate!)
        STUDENTS.forEach((st, si) => {
          const past = due < new Date()
          const done = past ? (si + ai) % 4 !== 0 : si % 3 === 1
          out[`${a.id}:${st.id}`] = {
            studentId: st.id,
            status: done ? 'submitted' : 'new',
            files: done ? [{ name: `${st.name.split(' ')[1] ?? st.name}_${a.name.replace(/\s+/g, '_')}.pdf`, size: 420_000 + si * 51_000, uploadedAt: new Date(due.getTime() - 86_400_000 * (1 + si)).toISOString() }] : [],
            onlineText: '',
            modifiedAt: done ? new Date(due.getTime() - 86_400_000 * (1 + si)).toISOString() : null,
            grade: done && past && si % 2 === 0 ? 55 + ((si * 7 + ai * 3) % 40) : null,
            feedback: done && past && si % 2 === 0 ? 'Good work. Improve the referencing.' : '',
            gradedAt: done && past && si % 2 === 0 ? d(-1, 10, 0) : null,
          }
        })
      }),
    ),
  )
  return out
}

const initialCourses: Course[] = COURSES.map((c) => ({ ...c, sections: buildSections(c.shortName) }))

const initialEvents: LmsEvent[] = [
  { id: 1, title: 'Mid-semester break begins', date: d(12, 8, 0), type: 'site' },
  { id: 2, title: 'Guest lecture — Strategy in Practice', date: d(3, 14, 0), courseId: 13195, type: 'course' },
  { id: 3, title: 'Project supervisor meeting', date: d(1, 10, 30), courseId: 13188, type: 'user' },
]

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
  saveSubmission: (activityId: number, studentId: string, patch: Partial<Submission>) => void
  gradeSubmission: (activityId: number, studentId: string, grade: number | null, feedback: string) => void
  addEvent: (e: Omit<LmsEvent, 'id'>) => void
  deleteEvent: (id: number) => void
  reset: () => void
}

const mapActivity = (courses: Course[], id: number, fn: (a: Activity) => Activity | null): Course[] =>
  courses.map((c) => ({
    ...c,
    sections: c.sections.map((s) => ({
      ...s,
      activities: s.activities.flatMap((a) => {
        if (a.id !== id) return [a]
        const r = fn(a)
        return r ? [r] : []
      }),
    })),
  }))

const fresh = () => {
  const initialCompletion: Record<string, boolean> = {}
  initialCourses.forEach((c) => c.sections.forEach((s) => s.activities.forEach((a, i) => { if (s.id <= 3 && i < 5) initialCompletion[a.id] = true })))
  return { courses: initialCourses, submissions: seedSubmissions(initialCourses), completion: initialCompletion, events: initialEvents, editMode: false }
}

export const useLmsStore = create<LmsState>()(
  persist(
    (set) => ({
      ...fresh(),
      setEditMode: (editMode) => set({ editMode }),
      toggleStar: (id) => set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c)) })),
      toggleHidden: (id) => set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)) })),
      touchCourse: (id) => set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, lastAccess: new Date().toISOString() } : c)) })),
      toggleCompletion: (id) => set((s) => ({ completion: { ...s.completion, [id]: !s.completion[id] } })),
      setActivityVisible: (id, visible) => set((s) => ({ courses: mapActivity(s.courses, id, (a) => ({ ...a, visible })) })),
      renameActivity: (id, name) => set((s) => ({ courses: mapActivity(s.courses, id, (a) => ({ ...a, name })) })),
      deleteActivity: (id) => set((s) => ({ courses: mapActivity(s.courses, id, () => null) })),
      addActivity: (courseId, sectionId, type, name) =>
        set((s) => ({
          courses: s.courses.map((c) =>
            c.id !== courseId ? c : {
              ...c,
              sections: c.sections.map((sec) =>
                sec.id !== sectionId ? sec : {
                  ...sec,
                  activities: [...sec.activities, { id: Date.now(), type, name, visible: true, description: '', assign: type === 'assign' ? assign({}) : undefined }],
                }),
            }),
        })),
      updateAssign: (id, patch) => set((s) => ({ courses: mapActivity(s.courses, id, (a) => ({ ...a, assign: { ...a.assign!, ...patch } })) })),
      saveSubmission: (id, studentId, patch) =>
        set((s) => {
          const key = `${id}:${studentId}`
          const prev = s.submissions[key] ?? { studentId, status: 'new', files: [], onlineText: '', modifiedAt: null, grade: null, feedback: '', gradedAt: null }
          return { submissions: { ...s.submissions, [key]: { ...prev, ...patch, modifiedAt: new Date().toISOString() } } }
        }),
      gradeSubmission: (id, studentId, grade, feedback) =>
        set((s) => {
          const key = `${id}:${studentId}`
          const prev = s.submissions[key] ?? { studentId, status: 'new', files: [], onlineText: '', modifiedAt: null, grade: null, feedback: '', gradedAt: null }
          return { submissions: { ...s.submissions, [key]: { ...prev, grade, feedback, gradedAt: new Date().toISOString() } } }
        }),
      addEvent: (e) => set((s) => ({ events: [...s.events, { ...e, id: Date.now() }] })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      reset: () => set(fresh()),
    }),
    { name: 'lms-data-v1' },
  ),
)

export const findActivity = (courses: Course[], id: number) => {
  for (const c of courses) for (const s of c.sections) for (const a of s.activities) if (a.id === id) return { course: c, section: s, activity: a }
  return null
}

export const courseProgress = (course: Course, completion: Record<string, boolean>) => {
  const all = course.sections.flatMap((s) => s.activities.filter((a) => a.visible))
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
