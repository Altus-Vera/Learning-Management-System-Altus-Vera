import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLmsStore, STUDENTS, CURRENT_STUDENT_ID, type Student } from './lmsStore'
import { useAuthStore } from './authStore'
import { useUiStore } from './uiStore'

export interface Batch { id: string; name: string; programme: string; intake: string; year: number; semester: number }
export interface StudentRecord extends Student { batchId: string; indexNo: string; phone: string }
export interface Block { reason: string; at: string; by: string }
export interface Payment { amount: number; paid: boolean; dueDate: string; paidAt: string | null; reference: string }
export type AuditKind = 'block' | 'unblock' | 'payment' | 'enrol' | 'unenrol' | 'lecturer' | 'grade' | 'override' | 'status' | 'extension' | 'settings' | 'visibility'
export interface AuditEntry { id: number; at: string; actor: string; role: string; kind: AuditKind; target: string; detail: string }

export const BATCHES: Batch[] = [
  { id: 'se22', name: 'BSc (Hons) Software Engineering — 22.2', programme: 'Software Engineering', intake: '22.2', year: 4, semester: 1 },
  { id: 'cs22', name: 'BSc (Hons) Computer Science — 22.2', programme: 'Computer Science', intake: '22.2', year: 4, semester: 1 },
  { id: 'bm23', name: 'BSc (Hons) Business Management — 23.1', programme: 'Business Management', intake: '23.1', year: 3, semester: 2 },
]

const EXTRA: Omit<StudentRecord, 'phone'>[] = [
  { id: 's7', name: 'RPK Kodithuwakku', email: 'rpkkodithuwakku@students.altusvera.lk', batchId: 'se22', indexNo: '' },
  { id: 's8', name: 'MAH Sheriffdeen', email: 'mahsheriffdeen@students.altusvera.lk', batchId: 'cs22', indexNo: '' },
  { id: 's9', name: 'DBN Ariyathilaka', email: 'dbnariyathilaka@students.altusvera.lk', batchId: 'cs22', indexNo: '' },
  { id: 's10', name: 'CKM Rathnayaka', email: 'ckmrathnayaka@students.altusvera.lk', batchId: 'cs22', indexNo: '' },
  { id: 's11', name: 'OVD Weerasena', email: 'ovdweerasena@students.altusvera.lk', batchId: 'bm23', indexNo: '' },
  { id: 's12', name: 'PLA Lakmali', email: 'plalakmali@students.altusvera.lk', batchId: 'bm23', indexNo: '' },
  { id: 's13', name: 'GTK Premarathna', email: 'gtkpremarathna@students.altusvera.lk', batchId: 'bm23', indexNo: '' },
  { id: 's14', name: 'YAR Ahmed', email: 'yarahmed@students.altusvera.lk', batchId: 'se22', indexNo: '' },
]

const seedStudents = (): StudentRecord[] => [
  ...STUDENTS.map((s, i) => ({ ...s, batchId: 'se22', indexNo: `SE/22.2/${String(1040 + i).padStart(4, '0')}`, phone: `07${i + 1}1234${500 + i}` })),
  ...EXTRA.map((s, i) => ({ ...s, indexNo: `${s.batchId.slice(0, 2).toUpperCase()}/${s.batchId === 'bm23' ? '23.1' : '22.2'}/${String(1100 + i).padStart(4, '0')}`, phone: `07${(i % 8) + 1}9876${400 + i}` })),
]

export const LECTURERS = ['Dr. K. Perera', 'Mr. S. Fernando', 'Prof. N. Silva', 'Ms. A. Jayasinghe', 'Dr. R. Wickrama', 'Mr. P. Bandara']

const day = (n: number) => { const t = new Date(); t.setDate(t.getDate() + n); t.setHours(23, 59, 0, 0); return t.toISOString() }

const seedPayments = (students: StudentRecord[], courseIds: number[]): Record<string, Payment> => {
  const out: Record<string, Payment> = {}
  students.forEach((s, si) => courseIds.forEach((c, ci) => {
    const paid = (si + ci) % 5 !== 0
    out[`${c}:${s.id}`] = { amount: 45000, paid, dueDate: day(-10 + ci), paidAt: paid ? day(-20 + ci) : null, reference: paid ? `AV-${c}-${1000 + si}` : '' }
  }))
  return out
}

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

  log: (kind: AuditKind, target: string, detail: string) => void
  blockAccount: (ids: string[], reason: string) => void
  unblockAccount: (ids: string[]) => void
  blockCourse: (courseId: number, ids: string[], reason: string) => void
  unblockCourse: (courseId: number, ids: string[]) => void
  setPaid: (courseId: number, studentId: string, paid: boolean) => void
  blockAllUnpaid: () => number
  setAutoBlock: (v: boolean) => void
  enrol: (courseId: number, ids: string[]) => void
  unenrol: (courseId: number, ids: string[]) => void
  setLecturer: (courseId: number, name: string) => void
  setExtension: (activityId: number, studentId: string, until: string | null) => void
  markOverride: (key: string, previous: string) => void
  ensurePayments: (courseIds: number[]) => void
}

const actor = () => {
  const u = useAuthStore.getState().user
  return { name: u?.fullName ?? 'System', role: u?.role === 'Admin' ? 'Assistant Registrar' : u?.role ?? 'System' }
}

export const nameOf = (id: string) => useAdminStore.getState().students.find((s) => s.id === id)?.name ?? id

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => {
      const log = (kind: AuditKind, target: string, detail: string) => {
        const a = actor()
        set((s) => ({ audit: [{ id: Date.now() + Math.random(), at: new Date().toISOString(), actor: a.name, role: a.role, kind, target, detail }, ...s.audit].slice(0, 500) }))
      }
      const blockEntry = (reason: string): Block => ({ reason, at: new Date().toISOString(), by: actor().name })
      return {
        students: seedStudents(),
        enrolments: {},
        courseLecturers: {},
        payments: {},
        accountBlocks: {},
        courseBlocks: {},
        extensions: {},
        overrides: {},
        autoBlockUnpaid: false,
        audit: [],
        log,
        blockAccount: (ids, reason) => { set((s) => ({ accountBlocks: { ...s.accountBlocks, ...Object.fromEntries(ids.map((id) => [id, blockEntry(reason)])) } })); ids.forEach((id) => log('block', nameOf(id), `Account blocked: ${reason}`)) },
        unblockAccount: (ids) => { set((s) => { const b = { ...s.accountBlocks }; ids.forEach((id) => delete b[id]); return { accountBlocks: b } }); ids.forEach((id) => log('unblock', nameOf(id), 'Account unblocked')) },
        blockCourse: (cid, ids, reason) => { set((s) => ({ courseBlocks: { ...s.courseBlocks, ...Object.fromEntries(ids.map((id) => [`${cid}:${id}`, blockEntry(reason)])) } })); ids.forEach((id) => log('block', nameOf(id), `Blocked from course ${courseName(cid)}: ${reason}`)) },
        unblockCourse: (cid, ids) => { set((s) => { const b = { ...s.courseBlocks }; ids.forEach((id) => delete b[`${cid}:${id}`]); return { courseBlocks: b } }); ids.forEach((id) => log('unblock', nameOf(id), `Unblocked from course ${courseName(cid)}`)) },
        setPaid: (cid, sid, paid) => {
          const key = `${cid}:${sid}`
          set((s) => ({ payments: { ...s.payments, [key]: { ...(s.payments[key] ?? { amount: 45000, dueDate: day(0), reference: '' }), paid, paidAt: paid ? new Date().toISOString() : null, reference: paid ? (s.payments[key]?.reference || `AV-${cid}-${Date.now() % 10000}`) : '' } } }))
          log('payment', nameOf(sid), `${courseName(cid)} fee marked as ${paid ? 'paid' : 'unpaid'}`)
          const st = get()
          if (paid && st.courseBlocks[key]?.reason.startsWith('Outstanding payment')) st.unblockCourse(cid, [sid])
          if (!paid && st.autoBlockUnpaid) st.blockCourse(cid, [sid], 'Outstanding payment for coursework')
        },
        blockAllUnpaid: () => {
          const st = get()
          const targets = Object.entries(st.payments).filter(([k, p]) => !p.paid && !st.courseBlocks[k]).map(([k]) => k.split(':'))
          targets.forEach(([cid, sid]) => st.blockCourse(Number(cid), [sid], 'Outstanding payment for coursework'))
          return targets.length
        },
        setAutoBlock: (v) => { set({ autoBlockUnpaid: v }); log('settings', 'Payments', `Automatic blocking of unpaid students ${v ? 'enabled' : 'disabled'}`) },
        enrol: (cid, ids) => { set((s) => ({ enrolments: { ...s.enrolments, [cid]: [...new Set([...(s.enrolments[cid] ?? STUDENTS.map((x) => x.id)), ...ids])] } })); get().ensurePayments([cid]); log('enrol', courseName(cid), `Enrolled ${ids.length} student(s): ${ids.map(nameOf).join(', ')}`) },
        unenrol: (cid, ids) => { set((s) => ({ enrolments: { ...s.enrolments, [cid]: (s.enrolments[cid] ?? STUDENTS.map((x) => x.id)).filter((x) => !ids.includes(x)) } })); log('unenrol', courseName(cid), `Removed ${ids.length} student(s): ${ids.map(nameOf).join(', ')}`) },
        setLecturer: (cid, name) => { set((s) => ({ courseLecturers: { ...s.courseLecturers, [cid]: name } })); log('lecturer', courseName(cid), `Lecturer set to ${name}`) },
        setExtension: (aid, sid, until) => {
          set((s) => { const e = { ...s.extensions }; if (until) e[`${aid}:${sid}`] = until; else delete e[`${aid}:${sid}`]; return { extensions: e } })
          const act = activityName(aid)
          log('extension', nameOf(sid), until ? `${act}: extension granted until ${new Date(until).toLocaleString()}` : `${act}: extension removed`)
        },
        markOverride: (key, previous) => set((s) => ({ overrides: { ...s.overrides, [key]: { by: actor().name, at: new Date().toISOString(), previous } } })),
        ensurePayments: (cids) => {
          const st = get()
          const missing = cids.filter((c) => !st.students.some((s) => st.payments[`${c}:${s.id}`]))
          if (missing.length) set((s) => ({ payments: { ...seedPayments(s.students, missing), ...s.payments } }))
        },
      }
    },
    { name: 'lms-admin-v1' },
  ),
)

const courseName = (cid: number) => { const c = useLmsStore.getState().courses.find((x) => x.id === cid); return c ? `${c.shortName}-${c.fullName}` : String(cid) }

const activityName = (aid: number) => {
  for (const c of useLmsStore.getState().courses) for (const s of c.sections) for (const a of s.activities) if (a.id === aid) return a.name
  return `Activity ${aid}`
}

export const enrolledIds =(enrolments: Record<number, string[]>, courseId: number) => enrolments[courseId] ?? STUDENTS.map((s) => s.id)

export function useEnrolled(courseId: number | undefined): StudentRecord[] {
  const students = useAdminStore((s) => s.students)
  const enrolments = useAdminStore((s) => s.enrolments)
  return useMemo(() => {
    if (courseId === undefined) return students.filter((s) => STUDENTS.some((x) => x.id === s.id))
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
  return useMemo(() => (teacher ? courses : courses.filter((c) => enrolledIds(enrolments, c.id).includes(CURRENT_STUDENT_ID))), [courses, enrolments, teacher])
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

export const logAudit =(kind: AuditKind, target: string, detail: string) => useAdminStore.getState().log(kind, target, detail)
