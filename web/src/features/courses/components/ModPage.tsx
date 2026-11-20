import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Download, ExternalLink, Check, Circle, Plus, MessageSquare, Timer, FileText, Users } from 'lucide-react'
import { useLmsStore, findActivity, type Activity, type Course } from '../../../store/lmsStore'
import { useRole } from '../../../store/uiStore'
import { useAuthStore } from '../../../store/authStore'
import { ActivityIcon, activityLabel } from '../../../components/ActivityIcon'
import { Modal } from '../../../components/Modal'
import { toast } from '../../../components/Toast'
import { fmtShort } from '../../../lib/format'

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

interface Post { id: number; subject: string; body: string; author: string; at: string; replies: number }

function ForumView({ a }: { a: Activity }) {
  const { isTeacher } = useRole()
  const user = useAuthStore((s) => s.user)
  const news = a.name === 'Announcements'
  const [posts, setPosts] = useState<Post[]>([
    { id: 1, subject: 'Lecture rescheduled to Friday', body: 'This week’s lecture will be held on Friday at 10:00 AM in Hall C2-004.', author: 'Module Lecturer', at: new Date(Date.now() - 2 * 864e5).toISOString(), replies: 0 },
    { id: 2, subject: 'Assignment guidelines published', body: 'The assignment description is now available under the Assignment section. Please form your groups before the deadline.', author: 'Module Lecturer', at: new Date(Date.now() - 6 * 864e5).toISOString(), replies: 3 },
  ])
  const [open, setOpen] = useState<Post | null>(null)
  const [adding, setAdding] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const canPost = !news || isTeacher

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mr-auto text-sm muted">{news ? 'General news and announcements' : 'Discussion forum'}</div>
        {canPost && <button className="btn btn-primary btn-sm" onClick={() => { setSubject(''); setBody(''); setAdding(true) }}><Plus size={15} /> {news ? 'Add a new announcement' : 'Add discussion topic'}</button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-5 py-3 font-semibold">Discussion</th><th className="px-5 py-3 font-semibold">Started by</th><th className="px-5 py-3 font-semibold">Replies</th><th className="px-5 py-3 font-semibold">Last post</th></tr></thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-t cursor-pointer hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }} onClick={() => setOpen(p)}>
              <td className="px-5 py-4 font-semibold" style={{ color: 'var(--color-heading)' }}>{p.subject}</td><td className="px-5 py-4 muted">{p.author}</td>
              <td className="px-5 py-4"><span className="badge badge-gray"><MessageSquare size={12} /> {p.replies}</span></td><td className="px-5 py-4 muted">{fmtShort(p.at)}</td>
            </tr>
          ))}
          {posts.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center muted">There are no discussion topics yet in this forum</td></tr>}
        </tbody>
      </table>
      <Modal open={!!open} title={open?.subject ?? ''} onClose={() => setOpen(null)} width={640}>
        {open && <><div className="text-xs muted mb-3">by {open.author} · {fmtShort(open.at)}</div><p className="leading-relaxed">{open.body}</p></>}
      </Modal>
      <Modal open={adding} title={news ? 'Add a new announcement' : 'Add discussion topic'} onClose={() => setAdding(false)} width={640}
        footer={<><button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" disabled={!subject.trim() || !body.trim()} onClick={() => { setPosts([{ id: Date.now(), subject, body, author: user?.fullName ?? 'Me', at: new Date().toISOString(), replies: 0 }, ...posts]); setAdding(false); toast('Your post was successfully added') }}>Post to forum</button></>}>
        <div className="space-y-4"><div><label className="form-label">Subject *</label><input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus /></div><div><label className="form-label">Message *</label><textarea rows={6} className="form-control" value={body} onChange={(e) => setBody(e.target.value)} /></div></div>
      </Modal>
    </div>
  )
}

const QUESTIONS = [
  { q: 'Which of the following best describes a SWOT analysis?', o: ['A financial forecasting model', 'An assessment of strengths, weaknesses, opportunities and threats', 'A pricing strategy', 'A marketing channel'], a: 1 },
  { q: 'Porter’s Five Forces is primarily used to analyse…', o: ['Industry competitiveness', 'Employee motivation', 'Cash flow', 'Product design'], a: 0 },
  { q: 'A mission statement describes…', o: ['Quarterly targets', 'The organisation’s fundamental purpose', 'Tax obligations', 'Board composition'], a: 1 },
]

function QuizView({ a }: { a: Activity }) {
  const [state, setState] = useState<'intro' | 'attempt' | 'review'>('intro')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [secs, setSecs] = useState(30 * 60)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (state !== 'attempt') return
    const t = setInterval(() => setSecs((s) => (s <= 1 ? (setState('review'), 0) : s - 1)), 1000)
    return () => clearInterval(t)
  }, [state])
  const score = QUESTIONS.filter((q, i) => answers[i] === q.a).length

  if (state === 'intro') return (
    <div className="card p-8 text-center max-w-xl mx-auto">
      <Timer size={40} className="mx-auto" style={{ color: 'var(--color-amber)' }} />
      <div className="mt-4 space-y-1 text-sm"><div>Attempts allowed: 1</div><div>Time limit: 30 mins</div><div>Grading method: Highest grade</div></div>
      <p className="text-xs muted mt-3">{a.description}</p>
      <button className="btn btn-primary mt-6" onClick={() => { setAnswers({}); setSecs(30 * 60); setState('attempt') }}>Attempt quiz now</button>
    </div>
  )
  if (state === 'review') return (
    <div className="card p-8 max-w-2xl mx-auto space-y-4">
      <div className="text-center"><div className="text-sm muted">Your grade</div><div className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>{((score / QUESTIONS.length) * 10).toFixed(2)} <span className="text-lg muted">/ 10.00</span></div><div className="text-sm muted">{score} of {QUESTIONS.length} correct</div></div>
      {QUESTIONS.map((q, i) => <div key={i} className="p-4 rounded-xl" style={{ background: answers[i] === q.a ? 'var(--color-green-soft)' : 'var(--color-red-soft)' }}><div className="font-semibold text-sm" style={{ color: 'var(--color-heading)' }}>{i + 1}. {q.q}</div><div className="text-sm mt-1">Correct answer: {q.o[q.a]}</div></div>)}
      <button className="btn btn-secondary" onClick={() => setState('intro')}>Finish review</button>
    </div>
  )
  return (
    <div className="grid lg:grid-cols-[1fr_240px] gap-6">
      <div className="space-y-4">
        {QUESTIONS.map((q, i) => (
          <div key={i} className="card p-6">
            <div className="text-xs font-semibold muted mb-1">Question {i + 1} · Marked out of 1.00</div>
            <div className="font-semibold mb-4" style={{ color: 'var(--color-heading)' }}>{q.q}</div>
            <div className="space-y-2">{q.o.map((o, j) => (
              <label key={j} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${answers[i] === j ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-bg-subtle)]'}`} style={{ borderColor: answers[i] === j ? undefined : 'var(--color-border)' }}>
                <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => setAnswers({ ...answers, [i]: j })} className="accent-[var(--color-primary)]" />
                <span className="text-sm">{String.fromCharCode(97 + j)}. {o}</span>
              </label>
            ))}</div>
          </div>
        ))}
      </div>
      <div className="card p-5 h-fit sticky top-24 space-y-4">
        <div className="text-xs font-semibold muted">Time left</div>
        <div className="text-3xl font-bold tabular-nums" style={{ color: secs < 300 ? 'var(--color-red)' : 'var(--color-heading)' }}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</div>
        <div className="text-xs font-semibold muted">Quiz navigation</div>
        <div className="flex gap-2">{QUESTIONS.map((_, i) => <span key={i} className="w-9 h-9 rounded-lg grid place-items-center text-sm font-semibold" style={{ background: answers[i] !== undefined ? 'var(--color-primary)' : 'var(--color-bg-subtle)', color: answers[i] !== undefined ? '#fff' : 'var(--color-heading)' }}>{i + 1}</span>)}</div>
        <button className="btn btn-primary w-full" onClick={() => setConfirm(true)}>Finish attempt…</button>
      </div>
      <Modal open={confirm} title="Submit all your answers and finish?" onClose={() => setConfirm(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={() => { setConfirm(false); setState('review'); toast('Attempt submitted') }}>Submit all and finish</button></>}>
        <p className="text-sm">Once you submit your answers, you will no longer be able to change them. {Object.keys(answers).length < QUESTIONS.length && <b>You have {QUESTIONS.length - Object.keys(answers).length} unanswered question(s).</b>}</p>
      </Modal>
    </div>
  )
}

function ChoiceView({ a }: { a: Activity }) {
  const { isTeacher } = useRole()
  const groups = ['Group 1', 'Group 2', 'Group 3', 'Group 4']
  const [counts, setCounts] = useState([3, 4, 2, 1])
  const [mine, setMine] = useState<number | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const LIMIT = 5
  return (
    <div className="card p-6 space-y-4">
      <p className="text-sm muted">{a.description || 'Select your assignment group. Each group is limited to 5 members.'}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {groups.map((g, i) => {
          const full = counts[i] >= LIMIT && mine !== i
          return (
            <label key={g} className={`flex items-center gap-3 p-4 rounded-xl border ${full ? 'opacity-50' : 'cursor-pointer hover:bg-[var(--color-bg-subtle)]'} ${pick === i ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : ''}`} style={{ borderColor: pick === i ? undefined : 'var(--color-border)' }}>
              <input type="radio" disabled={full || isTeacher} checked={pick === i} onChange={() => setPick(i)} className="accent-[var(--color-primary)]" />
              <Users size={18} className="muted" />
              <span className="flex-1 font-medium" style={{ color: 'var(--color-heading)' }}>{g}</span>
              <span className="badge badge-gray">{counts[i]}/{LIMIT}{full ? ' · Full' : ''}</span>
            </label>
          )
        })}
      </div>
      {!isTeacher && <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pick === null || pick === mine} onClick={() => { setCounts(counts.map((c, i) => c + (i === pick ? 1 : 0) - (i === mine ? 1 : 0))); setMine(pick); toast('Your selection has been saved') }}>Save my choice</button>
        {mine !== null && <button className="btn btn-secondary" onClick={() => { setCounts(counts.map((c, i) => c - (i === mine ? 1 : 0))); setMine(null); setPick(null); toast('Your choice has been removed') }}>Remove my choice</button>}
      </div>}
    </div>
  )
}

function Body({ a }: { a: Activity }) {
  if (a.type === 'resource') return <ResourceView a={a} />
  if (a.type === 'forum') return <ForumView a={a} />
  if (a.type === 'quiz') return <QuizView a={a} />
  if (a.type === 'choice') return <ChoiceView a={a} />
  if (a.type === 'url') return <div className="card p-8 text-center"><p className="text-sm muted mb-4">Click the link below to open the resource.</p><a href="https://teams.microsoft.com" target="_blank" rel="noreferrer" className="btn btn-primary !text-white"><ExternalLink size={16} /> Open {a.name}</a></div>
  return <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>{['Week 1 slides.pdf', 'Week 2 slides.pdf', 'Reading list.docx'].map((f) => <div key={f} className="flex items-center gap-3 p-4"><FileText size={18} className="muted" /><span className="flex-1" style={{ color: 'var(--color-heading)' }}>{f}</span><button className="icon-btn !w-8 !h-8" onClick={() => toast(`Downloading ${f}`, 'info')}><Download size={15} /></button></div>)}<div className="p-4"><button className="btn btn-secondary btn-sm" onClick={() => toast('Downloading folder…', 'info')}><Download size={15} /> Download folder</button></div></div>
}

export default function ModPage() {
  const { courseId, activityId } = useParams()
  const courses = useLmsStore((s) => s.courses)
  const found = useMemo(() => findActivity(courses, Number(activityId)), [courses, activityId])
  const done = useLmsStore((s) => !!s.completion[Number(activityId)])
  const toggle = useLmsStore((s) => s.toggleCompletion)
  const { isTeacher } = useRole()
  if (!found || (!found.activity.visible && !isTeacher)) return <Navigate to={`/courses/${courseId}`} replace />
  if (found.activity.type === 'assign') return <Navigate to={`/courses/${courseId}/assign/${activityId}`} replace />
  const { course, section, activity: a } = found as { course: Course; section: { id: number; title: string }; activity: Activity }

  return (
    <div className="space-y-6 max-w-[1100px]">
      <nav className="text-sm muted flex items-center gap-1.5 flex-wrap">
        <Link to="/dashboard" className="muted hover:underline">Dashboard</Link><span>/</span>
        <Link to={`/courses/${course.id}`} className="muted hover:underline">{course.shortName}</Link><span>/</span>
        <Link to={`/courses/${course.id}#s${section.id}`} className="muted hover:underline">{section.title}</Link><span>/</span>
        <span style={{ color: 'var(--color-heading)' }}>{a.name}</span>
      </nav>
      <div className="card p-6 flex items-center gap-4">
        <ActivityIcon type={a.type} size={52} />
        <div className="flex-1 min-w-0"><div className="text-xs font-semibold uppercase tracking-wider muted">{activityLabel(a.type)}</div><h1 className="text-2xl font-bold">{a.name}</h1></div>
        {!isTeacher && a.type !== 'quiz' && (
          <button onClick={() => toggle(a.id)} className={`btn ${done ? 'btn-green' : 'btn-secondary'}`}>{done ? <><Check size={16} strokeWidth={3} /> Done</> : <><Circle size={14} /> Mark as done</>}</button>
        )}
      </div>
      <Body a={a} />
    </div>
  )
}
