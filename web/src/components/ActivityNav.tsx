import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Activity, Course } from '../store/lmsStore'
import { useRole } from '../store/uiStore'

export const activityLink = (courseId: number, a: Activity) => (a.type === 'assign' ? `/courses/${courseId}/assign/${a.id}` : `/courses/${courseId}/mod/${a.id}`)

export function ActivityNav({ course, current }: { course: Course; current: number }) {
  const { isTeacher } = useRole()
  const navigate = useNavigate()
  const list = course.sections.flatMap((s) => s.activities.filter((a) => a.type !== 'label' && (a.visible || isTeacher)).map((a) => ({ a, section: s.title })))
  const i = list.findIndex((x) => x.a.id === current)
  const prev = list[i - 1]?.a
  const next = list[i + 1]?.a

  return (
    <div className="card p-4 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[160px]">
        {prev && <Link to={activityLink(course.id, prev)} className="flex items-center gap-2 text-sm group"><ChevronLeft size={18} className="muted shrink-0" /><span className="min-w-0"><span className="block text-xs muted">Previous activity</span><span className="block font-semibold truncate group-hover:underline" style={{ color: 'var(--color-heading)' }}>{prev.name}</span></span></Link>}
      </div>
      <select className="form-control !w-auto max-w-[280px] !h-9 text-sm" value="" onChange={(e) => { const a = list.find((x) => x.a.id === Number(e.target.value))?.a; if (a) navigate(activityLink(course.id, a)) }} aria-label="Jump to">
        <option value="">Jump to…</option>
        {course.sections.map((s) => {
          const items = list.filter((x) => x.section === s.title && x.a.id !== current)
          return items.length ? <optgroup key={s.id} label={s.title}>{items.map((x) => <option key={x.a.id} value={x.a.id}>{x.a.name}</option>)}</optgroup> : null
        })}
      </select>
      <div className="flex-1 min-w-[160px] flex justify-end">
        {next && <Link to={activityLink(course.id, next)} className="flex items-center gap-2 text-sm text-right group"><span className="min-w-0"><span className="block text-xs muted">Next activity</span><span className="block font-semibold truncate group-hover:underline" style={{ color: 'var(--color-heading)' }}>{next.name}</span></span><ChevronRight size={18} className="muted shrink-0" /></Link>}
      </div>
    </div>
  )
}
