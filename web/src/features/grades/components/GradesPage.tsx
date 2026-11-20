import { Link } from 'react-router-dom'
import { Folder, Download } from 'lucide-react'
import { useLmsStore, CURRENT_STUDENT_ID, type Course } from '../../../store/lmsStore'
import { useRole } from '../../../store/uiStore'
import { useEnrolled, useMyCourses } from '../../../store/adminStore'
import { ActivityIcon } from '../../../components/ActivityIcon'
import { toast } from '../../../components/Toast'

const assigns = (c: Course) => c.sections.flatMap((s) => s.activities.filter((a) => a.type === 'assign' && a.visible))

function useTotals(c: Course, studentId: string) {
  const subs = useLmsStore((s) => s.submissions)
  const items = assigns(c)
  const graded = items.filter((a) => subs[`${a.id}:${studentId}`]?.grade != null)
  const sum = graded.reduce((n, a) => n + subs[`${a.id}:${studentId}`]!.grade!, 0)
  const max = graded.reduce((n, a) => n + a.assign!.maxGrade, 0)
  return { items, total: graded.length ? (sum / max) * 100 : null }
}

const letter = (p: number | null) => (p === null ? '-' : p >= 85 ? 'A+' : p >= 75 ? 'A' : p >= 70 ? 'A-' : p >= 65 ? 'B+' : p >= 60 ? 'B' : p >= 55 ? 'B-' : p >= 50 ? 'C+' : p >= 45 ? 'C' : p >= 40 ? 'C-' : 'F')

function UserReport({ course }: { course: Course }) {
  const subs = useLmsStore((s) => s.submissions)
  const { items, total } = useTotals(course, CURRENT_STUDENT_ID)
  const weight = items.length ? 100 / items.length : 0
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mr-auto"><h2 className="font-bold">User report</h2><div className="text-sm muted">Your grades for {course.shortName}-{course.fullName}</div></div>
        <div className="text-right"><div className="text-xs muted">Course total</div><div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{total === null ? '-' : `${total.toFixed(2)}%`}</div></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
            {['Grade item', 'Calculated weight', 'Grade', 'Range', 'Percentage', 'Feedback', 'Contribution to course total'].map((h) => <th key={h} className="px-5 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}><td colSpan={7} className="px-5 py-3 font-semibold" style={{ color: 'var(--color-heading)' }}><span className="flex items-center gap-2"><Folder size={16} className="muted" />{course.shortName}-{course.fullName}</span></td></tr>
            {items.map((a) => {
              const sub = subs[`${a.id}:${CURRENT_STUDENT_ID}`]
              const g = sub?.grade ?? null
              const pct = g === null ? null : (g / a.assign!.maxGrade) * 100
              return (
                <tr key={a.id} className="border-t hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-5 py-3 pl-10"><Link to={`/courses/${course.id}/assign/${a.id}`} className="flex items-center gap-2.5 font-medium" style={{ color: 'var(--color-heading)' }}><ActivityIcon type="assign" size={28} />{a.name}</Link></td>
                  <td className="px-5 py-3">{g === null ? <span className="muted">0.00 % <span className="text-xs">( Empty )</span></span> : `${weight.toFixed(2)} %`}</td>
                  <td className="px-5 py-3 font-semibold" style={{ color: 'var(--color-heading)' }}>{g === null ? '-' : g.toFixed(2)}</td>
                  <td className="px-5 py-3 muted">0–{a.assign!.maxGrade}</td>
                  <td className="px-5 py-3">{pct === null ? '-' : <span className={`badge ${pct >= 50 ? 'badge-green' : 'badge-red'}`}>{pct.toFixed(2)} %</span>}</td>
                  <td className="px-5 py-3 muted max-w-[220px] truncate">{sub?.feedback || '-'}</td>
                  <td className="px-5 py-3 muted">{pct === null ? '0.00 %' : `${((pct * weight) / 100).toFixed(2)} %`}</td>
                </tr>
              )
            })}
            <tr className="border-t font-semibold" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-subtle)' }}>
              <td className="px-5 py-3" style={{ color: 'var(--color-heading)' }}>Course total</td><td className="px-5 py-3">-</td>
              <td className="px-5 py-3" style={{ color: 'var(--color-heading)' }}>{total === null ? '-' : total.toFixed(2)}</td><td className="px-5 py-3">0–100</td>
              <td className="px-5 py-3">{total === null ? '-' : `${total.toFixed(2)} %`}</td><td className="px-5 py-3">-</td><td className="px-5 py-3">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GraderReport({ course }: { course: Course }) {
  const STUDENTS = useEnrolled(course.id)
  const subs = useLmsStore((s) => s.submissions)
  const items = assigns(course)
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mr-auto"><h2 className="font-bold">Grader report</h2><div className="text-sm muted">{STUDENTS.length} students · {items.length} grade items</div></div>
        <button className="btn btn-secondary btn-sm" onClick={() => toast('Exporting grades to Excel…', 'info')}><Download size={15} /> Export</button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead><tr className="text-left text-xs muted" style={{ background: 'var(--color-bg-subtle)' }}>
            <th className="px-4 py-3 font-semibold sticky left-0 min-w-[220px]" style={{ background: 'var(--color-bg-subtle)' }}>Student</th>
            {items.map((a) => <th key={a.id} className="px-3 py-3 font-semibold whitespace-nowrap"><Link to={`/courses/${course.id}/assign/${a.id}?tab=submissions`} style={{ color: 'var(--color-heading)' }}>{a.name}</Link></th>)}
            <th className="px-4 py-3 font-semibold">Course total</th>
          </tr></thead>
          <tbody>
            {STUDENTS.map((st) => {
              const graded = items.filter((a) => subs[`${a.id}:${st.id}`]?.grade != null)
              const tot = graded.length ? (graded.reduce((n, a) => n + subs[`${a.id}:${st.id}`]!.grade! / a.assign!.maxGrade, 0) / graded.length) * 100 : null
              return (
                <tr key={st.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-2.5 font-medium sticky left-0" style={{ color: 'var(--color-heading)', background: 'var(--color-bg-card)' }}>{st.name}</td>
                  {items.map((a) => { const g = subs[`${a.id}:${st.id}`]?.grade; return <td key={a.id} className="px-3 py-2.5 text-center">{g == null ? <span className="muted">-</span> : g.toFixed(0)}</td> })}
                  <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--color-primary)' }}>{tot === null ? '-' : `${tot.toFixed(1)}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CourseGrades({ course }: { course: Course }) {
  const { isTeacher } = useRole()
  return isTeacher ? <GraderReport course={course} /> : <UserReport course={course} />
}

function OverviewRow({ c }: { c: Course }) {
  const { total } = useTotals(c, CURRENT_STUDENT_ID)
  return (
    <tr className="border-t hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}>
      <td className="px-5 py-4"><Link to={`/courses/${c.id}?tab=grades`} className="flex items-center gap-3 font-medium" style={{ color: 'var(--color-heading)' }}><span className="w-9 h-9 rounded-xl grid place-items-center text-[10px] font-bold text-white" style={{ background: c.color }}>{c.shortName.slice(0, 2)}</span>{c.shortName}-{c.fullName}</Link></td>
      <td className="px-5 py-4 muted">{c.term}</td>
      <td className="px-5 py-4 font-semibold" style={{ color: 'var(--color-heading)' }}>{total === null ? '-' : `${total.toFixed(2)}%`}</td>
      <td className="px-5 py-4">{total === null ? <span className="muted">-</span> : <span className={`badge ${total >= 50 ? 'badge-green' : 'badge-red'}`}>{letter(total)}</span>}</td>
    </tr>
  )
}

export function GradesPage() {
  const courses = useMyCourses()
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Grades overview</h1><p className="text-sm muted">Courses I am taking</p></div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
            <th className="px-5 py-3 font-semibold">Course name</th><th className="px-5 py-3 font-semibold">Term</th><th className="px-5 py-3 font-semibold">Grade</th><th className="px-5 py-3 font-semibold">Letter</th>
          </tr></thead>
          <tbody>{courses.map((c) => <OverviewRow key={c.id} c={c} />)}</tbody>
        </table>
      </div>
    </div>
  )
}

export default GradesPage
