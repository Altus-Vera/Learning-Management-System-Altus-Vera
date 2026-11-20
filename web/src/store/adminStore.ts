import { useMemo } from 'react'
import { create } from 'zustand'
import { useLmsStore, CURRENT_STUDENT_ID, type Student } from './lmsStore'
import { useAuthStore } from './authStore'
import { useUiStore } from './uiStore'
import { api } from '../services/api'
import { call } from '../services/sync'

export interface Batch { id: string; name: string; programme: string; intake: string; year: number; semester: number }
export interface StudentRecord extends Student { batchId: string; indexNo: string; phone: string }
export interface Block { reason: string; at: string; by: string }
export interface Payment { amount: number; paid: boolean; dueDate: string; paidAt: string | null; reference: string }
export type AuditKind = 'block' | 'unblock' | 'payment' | 'enrol' | 'unenrol' | 'lecturer' | 'grade' | 'override' | 'status' | 'extension' | 'settings' | 'visibility'
export interface AuditEntry { id: number; at: string; actor: string; role: string; kind: AuditKind; target: string; detail: string }

/** Filled from the server on every data load. */
export const BATCHES: Batch[] = []
export const LECTURERS: { id: string; name: string }[] = []

interface AdminState {
  students: StudentRecord[]
  enrolments: Record<number, string[]>
  courseLecturers: Record<number, string>
  payments: Record<string, Payment>
  accountBlocks: Record<string, Block>
  courseBlocks: Record<string, Block>
  extensions: Record<string, string>
  overrides: Record<string, { by: string; at: string; previous: string }>
  autoBlockUnpaid: boolean
  audit: AuditEntry[]

  blockAccount: (ids: string[], reason: string) => void
  unblockAccount: (ids: string[]) => void
  blockCourse: (courseId: number, ids: string[], reason: string) => void
  unblockCourse: (courseId: number, ids: string[]) => void
  unblockAll: (ids: string[]) => void
  setPaid: (courseId: number, studentId: string, paid: boolean) => void
  blockAllUnpaid: () => Promise<number>
  setAutoBlock: (v: boolean) => void
  enrol: (courseId: number, ids: string[]) => void
  unenrol: (courseId: number, ids: string[]) => void
  setLecturer: (courseId: number, lecturerId: string) => void
  overrideSubmission: (activityId: number, studentId: string, body: { grade: number | null; feedback: string; status: string; extensionUntil: string | null }) => Promise<boolean>
}

export const nameOf = (id: string) => useAdminStore.getState().students.find((s) => s.id === id)?.name ?? id

const reg = (path: string) => `/api/v1/registrar${path}`

export const useAdminStore = create<AdminState>()((set) => ({
  students: [],
  enrolments: {},
  courseLecturers: {},
  payments: {},
  accountBlocks: {},
  courseBlocks: {},
  extensions: {},
  overrides: {},
  autoBlockUnpaid: false,
  audit: [],

  blockAccount: (ids, reason) => { void call(() => api.post(reg('/blocks'), { studentIds: ids, courseId: null, reason })) },
  unblockAccount: (ids) => { void call(() => api.post(reg('/unblocks'), { studentIds: ids, courseId: null, all: false })) },
  blockCourse: (courseId, ids, reason) => { void call(() => api.post(reg('/blocks'), { studentIds: ids, courseId, reason })) },
  unblockCourse: (courseId, ids) => { void call(() => api.post(reg('/unblocks'), { studentIds: ids, courseId, all: false })) },
  unblockAll: (ids) => { void call(() => api.post(reg('/unblocks'), { studentIds: ids, courseId: null, all: true })) },
  setPaid: (courseId, studentId, paid) => {
    set((s) => ({ payments: { ...s.payments, [`${courseId}:${studentId}`]: { ...s.payments[`${courseId}:${studentId}`], paid } } }))
    void call(() => api.put(reg('/payments'), { courseId, studentId, paid }))
  },
  blockAllUnpaid: async () => (await call(() => api.post<{ blocked: number }>(reg('/payments/block-unpaid'))))?.data.blocked ?? 0,
  setAutoBlock: (enabled) => { set({ autoBlockUnpaid: enabled }); void call(() => api.put(reg('/settings/auto-block'), { enabled })) },
  enrol: (courseId, ids) => { void call(() => api.post(reg('/enrolments'), { courseId, studentIds: ids, remove: false })) },
  unenrol: (courseId, ids) => { void call(() => api.post(reg('/enrolments'), { courseId, studentIds: ids, remove: true })) },
  setLecturer: (courseId, lecturerId) => { void call(() => api.put(reg(`/courses/${courseId}/lecturer`), { lecturerId })) },
  overrideSubmission: async (activityId, studentId, body) => !!(await call(() => api.put(reg('/submissions'), { activityId, studentId, ...body }))),
}))

export const enrolledIds = (enrolments: Record<number, string[]>, courseId: number) => enrolments[courseId] ?? []

export function useEnrolled(courseId: number | undefined): StudentRecord[] {
  const students = useAdminStore((s) => s.students)
  const enrolments = useAdminStore((s) => s.enrolments)
  return useMemo(() => {
    if (courseId === undefined) return []
    const ids = enrolledIds(enrolments, courseId)
    return students.filter((s) => ids.includes(s.id))
  }, [students, enrolments, courseId])
}

export function useCourseIdOfActivity(activityId: number) {
  const courses = useLmsStore((s) => s.courses)
  return useMemo(() => courses.find((c) => c.sections.some((s) => s.activities.some((a) => a.id === activityId)))?.id, [courses, activityId])
}

export function useBlockState(courseId?: number, studentId: string = CURRENT_STUDENT_ID) {
  const account = useAdminStore((s) => s.accountBlocks[studentId])
  const course = useAdminStore((s) => (courseId ? s.courseBlocks[`${courseId}:${studentId}`] : undefined))
  return { account, course, blocked: !!account || !!course, reason: account?.reason ?? course?.reason }
}

export function useExtension(activityId: number, studentId: string = CURRENT_STUDENT_ID) {
  return useAdminStore((s) => s.extensions[`${activityId}:${studentId}`] ?? null)
}

export function useMyCourses() {
  const courses = useLmsStore((s) => s.courses)
  const enrolments = useAdminStore((s) => s.enrolments)
  const role = useAuthStore((s) => s.user?.role)
  const viewAsStudent = useUiStore((s) => s.viewAsStudent)
  const teacher = (role === 'Lecturer' || role === 'Admin') && !viewAsStudent
  return useMemo(() => (teacher || role !== 'Student' ? courses : courses.filter((c) => enrolledIds(enrolments, c.id).includes(CURRENT_STUDENT_ID))), [courses, enrolments, teacher, role])
}

export function useMyBlocks() {
  const account = useAdminStore((s) => s.accountBlocks[CURRENT_STUDENT_ID])
  const courseBlocks = useAdminStore((s) => s.courseBlocks)
  const courses = useLmsStore((s) => s.courses)
  return useMemo(() => {
    const out: { label: string; reason: string }[] = []
    if (account) out.push({ label: 'Entire account', reason: account.reason })
    Object.entries(courseBlocks).forEach(([k, b]) => {
      const [cid, sid] = k.split(':')
      if (sid !== CURRENT_STUDENT_ID) return
      const c = courses.find((x) => x.id === Number(cid))
      out.push({ label: c ? `${c.shortName}-${c.fullName}` : cid, reason: b.reason })
    })
    return out
  }, [account, courseBlocks, courses])
}

/** Auditing is recorded by the server for every change; kept for call sites that describe UI-only actions. */
export const logAudit = (_kind: AuditKind, _target: string, _detail: string) => undefined
