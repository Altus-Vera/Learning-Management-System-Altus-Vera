import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Download, ExternalLink, Check, Circle, FileText, Pencil, Save } from 'lucide-react'
import { useLmsStore, findActivity, type Activity } from '../../../store/lmsStore'
import { useRole } from '../../../store/uiStore'
import { ActivityIcon, activityLabel } from '../../../components/ActivityIcon'
import { ActivityNav } from '../../../components/ActivityNav'
import { toast } from '../../../components/Toast'
import { fmtShort } from '../../../lib/format'
import { ForumView } from '../../activities/ForumView'
import { QuizView } from '../../activities/QuizView'
import { FeedbackView, ChoiceGroupView, PageView } from '../../activities/OtherViews'

function ResourceView({ a }: { a: Activity }) {
  return (
    <div className="card p-6">
      <div className="rounded-2xl grid place-items-center h-[420px] border" style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)' }}>
        <div className="text-center">
          <FileText size={56} className="mx-auto" style={{ color: 'var(--color-red)' }} />
          <div className="mt-3 font-semibold" style={{ color: 'var(--color-heading)' }}>{a.name}.pdf</div>
          <div className="text-sm muted">PDF document · 2.4 MB · Uploaded {fmtShort(new Date(Date.now() - 864e6).toISOString())}</div>
          <button className="btn btn-primary mt-4" onClick={() => toast(`Downloading ${a.name}.pdf`, 'info')}><Download size={16} /> Download</button>
        </div>
      </div>
    </div>
  )
}

function FolderView({ a }: { a: Activity }) {
  const files = a.name === 'Past Papers' ? ['Past Paper 2023.pdf', 'Past Paper 2022.pdf', 'Past Paper 2021.pdf', 'Marking Scheme 2023.pdf'] : ['Week 1 slides.pdf', 'Week 2 slides.pdf', 'Reading list.docx']
  return (
    <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
      {files.map((f) => <div key={f} className="flex items-center gap-3 p-4" style={{ borderColor: 'var(--color-border)' }}><FileText size={18} className="muted" /><span className="flex-1" style={{ color: 'var(--color-heading)' }}>{f}</span><button className="icon-btn !w-8 !h-8" onClick={() => toast(`Downloading ${f}`, 'info')} aria-label={`Download ${f}`}><Download size={15} /></button></div>)}
      <div className="p-4"><button className="btn btn-secondary btn-sm" onClick={() => toast(`Downloading ${a.name}.zip`, 'info')}><Download size={15} /> Download folder</button></div>
    </div>
  )
}

function UrlView({ a }: { a: Activity }) {
  return <div className="card p-8 text-center"><p className="text-sm muted mb-4">Click the link below to open the resource.</p><a href="https://teams.microsoft.com" target="_blank" rel="noreferrer" className="btn btn-primary !text-white"><ExternalLink size={16} /> Open {a.name}</a></div>
}

function Body({ a }: { a: Activity }) {
  switch (a.type) {
    case 'resource': return <ResourceView a={a} />
    case 'forum': return <ForumView a={a} />
    case 'quiz': return <QuizView a={a} />
    case 'choice': return <ChoiceGroupView a={a} />
    case 'feedback': return <FeedbackView a={a} />
    case 'page': return <PageView a={a} />
    case 'url': return <UrlView a={a} />
    default: return <FolderView a={a} />
  }
}

function DescriptionEditor({ a }: { a: Activity }) {
  const update = useLmsStore((s) => s.updateActivity)
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(a.description ?? '')
  if (!editing) return <button className="btn btn-ghost btn-sm" onClick={() => { setV(a.description ?? ''); setEditing(true) }}><Pencil size={14} /> Edit description</button>
  return (
    <div className="w-full space-y-2"><textarea rows={3} className="form-control" value={v} onChange={(e) => setV(e.target.value)} /><div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => { update(a.id, { description: v }); setEditing(false); toast('Changes saved') }}><Save size={14} /> Save</button><button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button></div></div>
  )
}

export default function ModPage() {
  const { courseId, activityId } = useParams()
  const courses = useLmsStore((s) => s.courses)
  const found = useMemo(() => findActivity(courses, Number(activityId)), [courses, activityId])
  const done = useLmsStore((s) => !!s.completion[Number(activityId)])
  const toggle = useLmsStore((s) => s.toggleCompletion)
  const { isTeacher } = useRole()
  if (!found || (!found.activity.visible && !isTeacher) || found.activity.type === 'label') return <Navigate to={`/courses/${courseId}`} replace />
  if (found.activity.type === 'assign') return <Navigate to={`/courses/${courseId}/assign/${activityId}`} replace />
  const { course, section, activity: a } = found
  const manual = !['quiz', 'feedback', 'choice'].includes(a.type)

  return (
    <div className="space-y-6 max-w-[1100px]">
      <nav className="text-sm muted flex items-center gap-1.5 flex-wrap">
        <Link to="/dashboard" className="muted hover:underline">Dashboard</Link><span>/</span>
        <Link to={`/courses/${course.id}`} className="muted hover:underline">{course.shortName}</Link><span>/</span>
        <Link to={`/courses/${course.id}#s${section.id}`} className="muted hover:underline">{section.title}</Link><span>/</span>
        <span style={{ color: 'var(--color-heading)' }}>{a.name}</span>
      </nav>
      <div className="card p-6 flex flex-wrap items-center gap-4">
        <ActivityIcon type={a.type} size={52} />
        <div className="flex-1 min-w-0"><div className="text-xs font-semibold uppercase tracking-wider muted">{activityLabel(a.type)}</div><h1 className="text-2xl font-bold">{a.name}</h1>{!a.visible && <span className="badge badge-gray mt-1">Hidden from students</span>}</div>
        {!isTeacher && manual && (
          <button onClick={() => toggle(a.id)} className={`btn ${done ? 'btn-green' : 'btn-secondary'}`}>{done ? <><Check size={16} strokeWidth={3} /> Done</> : <><Circle size={14} /> Mark as done</>}</button>
        )}
        {isTeacher && a.type !== 'page' && <DescriptionEditor a={a} />}
      </div>
      <Body a={a} />
      <ActivityNav course={course} current={a.id} />
    </div>
  )
}
