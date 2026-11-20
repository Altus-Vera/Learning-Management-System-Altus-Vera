import { Link } from 'react-router-dom'
import { Award } from 'lucide-react'
import { useLmsStore, CURRENT_STUDENT_ID, type Course } from '../../../store/lmsStore'
import { useActivityStore, seedDiscussions } from '../../../store/activityStore'
import { useRole } from '../../../store/uiStore'
import { BADGES } from '../../../store/prefsStore'
import { ActivityIcon } from '../../../components/ActivityIcon'
import { activityLink } from '../../../components/ActivityNav'
import { fmtShort } from '../../../lib/format'

type Kind = 'assign' | 'quiz' | 'forum' | 'choice' | 'resource' | 'badges'
const TITLES: Record<Kind, string> = { assign: 'Assignments', quiz: 'Quizzes', forum: 'Forums', choice: 'Group choices', resource: 'Resources', badges: 'Course badges' }

export function ActivityIndex({ course, kind }: { course: Course; kind: Kind }) {
  const { isTeacher } = useRole()
  const submissions = useLmsStore((s) => s.submissions)
  const forums = useActivityStore((s) => s.forums)
  const attempts = useActivityStore((s) => s.attempts)

  if (kind === 'badges') {
    const list = BADGES.filter((b) => b.course === course.shortName)
    return (
      <div className="card p-6">
        <h2 className="font-bold mb-4">{TITLES.badges}</h2>
        {list.length === 0 ? <p className="muted text-sm">There are no badges available in this course.</p> : list.map((b) => (
          <div key={b.id} className="flex items-center gap-4"><span className="w-14 h-14 rounded-full grid place-items-center text-white" style={{ background: b.color }}><Award size={26} /></span><div><div className="font-semibold" style={{ color: 'var(--color-heading)' }}>{b.name}</div><div className="text-sm muted">{b.description}</div></div></div>
        ))}
      </div>
    )
  }

  const types = kind === 'resource' ? ['resource', 'folder', 'page', 'url'] : [kind]
  const rows = course.sections.flatMap((s) => s.activities.filter((a) => types.includes(a.type) && (a.visible || isTeacher)).map((a) => ({ s, a })))
  const cols = kind === 'assign' ? ['Topic', 'Assignments', 'Due date', 'Submission', 'Grade'] : kind === 'quiz' ? ['Topic', 'Name', 'Quiz closes', 'Grade'] : kind === 'forum' ? ['Forum', 'Description', 'Discussions'] : kind === 'choice' ? ['Topic', 'Name'] : ['Topic', 'Name', 'Type']

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}>{TITLES[kind]}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>{cols.map((c) => <th key={c} className="px-5 py-3">{c}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ s, a }) => {
              const name = <Link to={activityLink(course.id, a)} className="flex items-center gap-2.5 font-medium" style={{ color: 'var(--color-heading)' }}><ActivityIcon type={a.type} size={28} />{a.name}</Link>
              const sub = submissions[`${a.id}:${CURRENT_STUDENT_ID}`]
              return (
                <tr key={a.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  {kind !== 'forum' && <td className="px-5 py-3 muted">{s.title}</td>}
                  {kind === 'forum' ? <>
                    <td className="px-5 py-3">{name}</td><td className="px-5 py-3 muted">{a.description}</td><td className="px-5 py-3">{(forums[a.id] ?? seedDiscussions(a.name === 'Announcements')).length}</td>
                  </> : <td className="px-5 py-3">{name}</td>}
                  {kind === 'assign' && <>
                    <td className="px-5 py-3 muted whitespace-nowrap">{fmtShort(a.assign?.dueDate ?? null)}</td>
                    <td className="px-5 py-3">{isTeacher ? <span className="muted">{Object.entries(submissions).filter(([k, v]) => k.startsWith(`${a.id}:`) && v.status === 'submitted').length} submitted</span> : sub?.status === 'submitted' ? <span className="badge badge-green">Submitted for grading</span> : sub?.status === 'draft' ? <span className="badge badge-amber">Draft</span> : <span className="badge badge-gray">No submission</span>}</td>
                    <td className="px-5 py-3">{!isTeacher && sub?.grade != null ? `${sub.grade.toFixed(2)} / ${a.assign!.maxGrade.toFixed(2)}` : '-'}</td>
                  </>}
                  {kind === 'quiz' && <>
                    <td className="px-5 py-3 muted whitespace-nowrap">{fmtShort(a.quiz?.closeDate ?? null)}</td>
                    <td className="px-5 py-3">{(() => { const done = (attempts[a.id] ?? []).filter((x) => x.userId === CURRENT_STUDENT_ID && x.score !== null); return !isTeacher && done.length ? `${Math.max(...done.map((x) => (x.score! / Math.max(1, x.maxScore ?? 5)) * (a.quiz?.maxGrade ?? 10))).toFixed(2)}` : '-' })()}</td>
                  </>}
                  {kind === 'resource' && <td className="px-5 py-3 muted capitalize">{a.type === 'resource' ? 'File' : a.type}</td>}
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={cols.length} className="px-5 py-10 text-center muted">There are no {TITLES[kind].toLowerCase()} in this course</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
