import { useMemo, useState } from 'react'
import { Users, Target, Timer, GraduationCap, AlertTriangle, CheckCircle2, BellRing, Send, HelpCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'
import { useActivityStore, QUIZ_QUESTIONS, type QuizAttempt } from '../../store/activityStore'
import { useEnrolled, useCourseIdOfActivity } from '../../store/adminStore'
import type { Activity, QuizSettings } from '../../store/lmsStore'
import { notifyStudent } from '../insights/insightsApi'
import { errorMessage, loadBootstrap } from '../../services/sync'
import { toast } from '../../components/Toast'
import { Modal } from '../../components/Modal'
import { finalGrade } from './QuizView'

const EMPTY: QuizAttempt[] = []
const N = QUIZ_QUESTIONS.length
const tooltipStyle = { background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12 }

function Stat({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string | number; sub?: string; tone: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon size={20} /></span>
      <div className="min-w-0"><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{value}</div><div className="text-xs font-medium muted">{label}</div>{sub && <div className="text-[11px] muted">{sub}</div>}</div>
    </div>
  )
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/** Facility = share answering correctly; discrimination = correct rate in the top half minus the bottom half. */
const verdict = (facility: number, discrimination: number | null, n: number) => {
  if (n < 2) return { label: 'Not enough data', tone: 'badge-gray' }
  if (facility < 0.3) return { label: 'Too difficult', tone: 'badge-red' }
  if (discrimination !== null && discrimination < 0) return { label: 'Review — may be misleading', tone: 'badge-red' }
  if (facility > 0.9) return { label: 'Very easy', tone: 'badge-amber' }
  if (discrimination !== null && discrimination < 0.2) return { label: 'Weak discrimination', tone: 'badge-amber' }
  return { label: 'Good question', tone: 'badge-green' }
}

export function QuizAnalytics({ a, s }: { a: Activity; s: QuizSettings }) {
  const courseId = useCourseIdOfActivity(a.id)
  const students = useEnrolled(courseId)
  const all = useActivityStore((x) => x.attempts[a.id]) ?? EMPTY
  const [remind, setRemind] = useState<{ ids: string[]; message: string } | null>(null)
  const [sending, setSending] = useState(false)
  const now = new Date()
  const closed = !!s.closeDate && now > new Date(s.closeDate)

  const data = useMemo(() => {
    const ids = new Set(students.map((st) => st.id))
    const finished = all.filter((t) => t.finishedAt && t.score !== null && ids.has(t.userId))
    const perStudent = students.map((st) => {
      const mine = finished.filter((t) => t.userId === st.id)
      return { st, attempts: mine, grade: mine.length ? finalGrade(mine, s) : null }
    })
    const attempted = perStudent.filter((p) => p.grade !== null)
    const grades = attempted.map((p) => (p.grade! / s.maxGrade) * 100)
    const mins = finished.map((t) => (new Date(t.finishedAt!).getTime() - new Date(t.startedAt).getTime()) / 60000).filter((m) => m >= 0)

    const dist = Array.from({ length: N + 1 }, (_, score) => ({ score: `${score}/${N}`, count: finished.filter((t) => t.score === score).length, pass: score / N >= 0.5 }))

    // Best attempt per student for item analysis, so repeat attempts don't skew the question statistics.
    const best = attempted.map((p) => p.attempts.reduce((x, y) => ((y.score ?? 0) > (x.score ?? 0) ? y : x)))
    const ranked = [...best].sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    const half = Math.floor(ranked.length / 2)
    const top = ranked.slice(0, half), bottom = ranked.slice(ranked.length - half)
    const rate = (set: QuizAttempt[], qi: number) => (set.length ? set.filter((t) => t.answers[qi] === QUIZ_QUESTIONS[qi].a).length / set.length : 0)
    const questions = QUIZ_QUESTIONS.map((q, qi) => {
      const answered = best.filter((t) => t.answers[qi] !== undefined)
      const options = q.o.map((text, oi) => ({ text, count: best.filter((t) => t.answers[qi] === oi).length, correct: oi === q.a }))
      const blank = best.length - answered.length
      const facility = best.length ? options[q.a].count / best.length : 0
      const discrimination = half >= 1 ? rate(top, qi) - rate(bottom, qi) : null
      const wrong = options.filter((o) => !o.correct).sort((x, y) => y.count - x.count)[0]
      return { q, qi, options, blank, facility, discrimination, topDistractor: wrong && wrong.count > 0 ? wrong : null, verdict: verdict(facility, discrimination, best.length) }
    })

    const byDay = new Map<string, number>()
    finished.forEach((t) => { const k = format(new Date(t.finishedAt!), 'd MMM'); byDay.set(k, (byDay.get(k) ?? 0) + 1) })

    return { finished, perStudent, attempted, grades, mins, dist, questions, byDay: [...byDay.entries()].map(([day, count]) => ({ day, count })) }
  }, [students, all, s])

  const participation = students.length ? Math.round((data.attempted.length / students.length) * 100) : 0
  const mean = data.grades.length ? data.grades.reduce((x, y) => x + y, 0) / data.grades.length : null
  const med = median(data.grades)
  const passRate = data.grades.length ? Math.round((data.grades.filter((g) => g >= 50).length / data.grades.length) * 100) : null
  const avgMins = data.mins.length ? data.mins.reduce((x, y) => x + y, 0) / data.mins.length : null
  const notAttempted = data.perStudent.filter((p) => p.grade === null)
  const hardest = [...data.questions].sort((x, y) => x.facility - y.facility)[0]

  const openRemind = (ids: string[]) => setRemind({
    ids,
    message: `Reminder: the quiz “${a.name}” ${s.closeDate ? `closes on ${format(new Date(s.closeDate), 'EEEE, d MMMM yyyy, h:mm a')}` : 'is open'}. You have not attempted it yet — you will have ${s.timeLimitMins} minutes once you start. Please complete it before it closes.`,
  })
  const sendReminders = async () => {
    if (!remind || !courseId) return
    setSending(true)
    let sent = 0
    for (const id of remind.ids) { try { await notifyStudent(id, courseId, remind.message); sent++ } catch (e) { toast(errorMessage(e), 'error') } }
    setSending(false); setRemind(null)
    if (sent) { toast(`Reminder sent to ${sent} student${sent > 1 ? 's' : ''}`); void loadBootstrap() }
  }

  if (!students.length) return <div className="card p-12 text-center muted">No students are enrolled in this course yet.</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={Users} label="Participation" value={`${participation}%`} sub={`${data.attempted.length} of ${students.length} students · ${data.finished.length} attempt(s)`} tone="#0033A0" />
        <Stat icon={GraduationCap} label="Average grade" value={mean === null ? '-' : `${mean.toFixed(1)}%`} sub={med === null ? 'No attempts yet' : `Median ${med.toFixed(1)}% · ${s.gradingMethod.toLowerCase()}`} tone="#7C3AED" />
        <Stat icon={CheckCircle2} label="Pass rate" value={passRate === null ? '-' : `${passRate}%`} sub="Grade of 50% or more" tone="#16A34A" />
        <Stat icon={Timer} label="Average time taken" value={avgMins === null ? '-' : avgMins < 1 ? '< 1 min' : `${avgMins.toFixed(1)} min`} sub={`Time limit ${s.timeLimitMins} min`} tone="#D97706" />
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6">
        <section className="card p-5">
          <h2 className="font-bold mb-1">Score distribution</h2>
          <p className="text-xs muted mb-2">All finished attempts · red bars are below 50%</p>
          <div className="h-56">
            {data.finished.length === 0 ? <div className="h-full grid place-items-center text-sm muted">No attempts yet.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dist} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="score" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--color-bg-subtle)' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="Attempts" radius={[6, 6, 0, 0]}>{data.dist.map((d) => <Cell key={d.score} fill={d.pass ? '#0033A0' : '#DC2626'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Target size={16} style={{ color: 'var(--color-primary)' }} /> Key findings</h2>
          {data.attempted.length === 0 ? <p className="text-sm muted">Findings appear once students attempt the quiz.</p> : (
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2"><span className="muted shrink-0">•</span><span><b style={{ color: 'var(--color-heading)' }}>{notAttempted.length}</b> enrolled student{notAttempted.length === 1 ? ' has' : 's have'} not attempted{closed ? ' and the quiz is closed' : ''}.</span></li>
              {hardest && <li className="flex gap-2"><span className="muted shrink-0">•</span><span>Hardest question: <b style={{ color: 'var(--color-heading)' }}>Q{hardest.qi + 1}</b> — only {Math.round(hardest.facility * 100)}% answered correctly{hardest.topDistractor ? `; most chose “${hardest.topDistractor.text}”` : ''}.</span></li>}
              {data.questions.filter((q) => q.verdict.tone === 'badge-red').length > 0 && <li className="flex gap-2"><span className="muted shrink-0">•</span><span><b style={{ color: 'var(--color-red)' }}>{data.questions.filter((q) => q.verdict.tone === 'badge-red').length}</b> question(s) flagged for review below.</span></li>}
              {passRate !== null && passRate < 50 && <li className="flex gap-2"><span className="muted shrink-0">•</span><span>Most students scored below 50% — consider revisiting this topic in class.</span></li>}
              {avgMins !== null && avgMins > s.timeLimitMins * 0.9 && <li className="flex gap-2"><span className="muted shrink-0">•</span><span>Students are using almost all the time — the time limit may be tight.</span></li>}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-bold flex items-center gap-2"><HelpCircle size={16} style={{ color: 'var(--color-primary)' }} /> Question analysis</h2>
          <p className="text-xs muted">Based on each student's best attempt. Discrimination compares the top and bottom halves of the class — higher is better.</p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {data.questions.map((q) => (
            <div key={q.qi} className="p-5 grid lg:grid-cols-[1fr_260px] gap-5" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="flex items-start gap-2 mb-3"><span className="badge badge-blue shrink-0">Q{q.qi + 1}</span><span className="font-medium" style={{ color: 'var(--color-heading)' }}>{q.q.q}</span></div>
                <div className="space-y-1.5">
                  {q.options.map((o, oi) => {
                    const total = data.attempted.length || 1
                    return (
                      <div key={oi} className="grid grid-cols-[1fr_140px_44px] items-center gap-3 text-sm">
                        <span className="truncate" style={{ color: o.correct ? 'var(--color-green)' : 'var(--color-text)', fontWeight: o.correct ? 600 : 400 }}>{String.fromCharCode(97 + oi)}. {o.text}{o.correct && ' ✓'}</span>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-subtle)' }}><div className="h-full rounded-full" style={{ width: `${(o.count / total) * 100}%`, background: o.correct ? 'var(--color-green)' : 'var(--color-border-strong)' }} /></div>
                        <span className="text-right text-xs muted">{o.count}</span>
                      </div>
                    )
                  })}
                  {q.blank > 0 && <div className="text-xs muted">{q.blank} left blank</div>}
                </div>
              </div>
              <div className="space-y-3">
                <span className={`badge ${q.verdict.tone}`}>{q.verdict.label}</span>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}><div className="text-xs muted">Answered correctly</div><b style={{ color: 'var(--color-heading)' }}>{Math.round(q.facility * 100)}%</b></div>
                  <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}><div className="text-xs muted">Discrimination</div><b style={{ color: q.discrimination !== null && q.discrimination < 0 ? 'var(--color-red)' : 'var(--color-heading)' }}>{q.discrimination === null ? '-' : q.discrimination.toFixed(2)}</b></div>
                </div>
                {q.topDistractor && q.facility < 0.7 && <p className="text-xs muted">Common wrong answer: “{q.topDistractor.text}” ({q.topDistractor.count})</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-bold mr-auto flex items-center gap-2"><AlertTriangle size={16} style={{ color: 'var(--color-red)' }} /> Not attempted ({notAttempted.length})</h2>
          {notAttempted.length > 0 && !closed && <button className="btn btn-secondary btn-sm" onClick={() => openRemind(notAttempted.map((p) => p.st.id))}><BellRing size={14} /> Remind all</button>}
        </div>
        {notAttempted.length === 0 ? <div className="p-8 text-center text-sm muted">Every enrolled student has attempted this quiz. 🎉</div> : (
          <table className="w-full text-sm"><tbody>
            {notAttempted.map((p) => (
              <tr key={p.st.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-5 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{p.st.name}</div><div className="text-xs muted">{p.st.indexNo}</div></td>
                <td className="px-5 py-3 text-xs muted">{closed ? 'Quiz closed without an attempt' : 'Not attempted yet'}</td>
                <td className="px-5 py-3 text-right">{!closed && <button className="btn btn-ghost btn-sm" onClick={() => openRemind([p.st.id])}><Send size={14} /> Remind</button>}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </section>

      <Modal open={!!remind} title={`Send reminder to ${remind?.ids.length ?? 0} student${(remind?.ids.length ?? 0) > 1 ? 's' : ''}`} onClose={() => setRemind(null)} width={580}
        footer={<><button className="btn btn-secondary" onClick={() => setRemind(null)}>Cancel</button><button className="btn btn-primary" disabled={sending || !remind?.message.trim()} onClick={() => void sendReminders()}><Send size={15} /> {sending ? 'Sending…' : 'Send reminder'}</button></>}>
        <p className="text-sm muted mb-3">Each student receives the reminder in Messages and as a notification.</p>
        {remind && <textarea rows={5} className="form-control" value={remind.message} onChange={(e) => setRemind({ ...remind, message: e.target.value })} />}
      </Modal>
    </div>
  )
}
