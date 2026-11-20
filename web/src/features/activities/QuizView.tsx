import { useEffect, useMemo, useRef, useState } from 'react'
import { Timer, Save, BarChart3, Settings2, Play, Eye, PieChart, Database, Shuffle, Loader2 } from 'lucide-react'
import { QuizAnalytics } from './QuizAnalytics'
import { useActivityStore, useMe, type QuizAttempt } from '../../store/activityStore'
import { useLmsStore, quizDefaults, type Activity, type QuizSettings } from '../../store/lmsStore'
import { Modal } from '../../components/Modal'
import { useEnrolled, useCourseIdOfActivity, useBlockState } from '../../store/adminStore'
import { toast } from '../../components/Toast'
import { errorMessage } from '../../services/sync'
import { fmtDate, fromLocalInput, toLocalInput } from '../../lib/format'
import { getReview, useQuestionBank, type AttemptReview } from './questionBankApi'

const EMPTY: QuizAttempt[] = []

const pct = (a: QuizAttempt) => (a.score ?? 0) / Math.max(1, a.maxScore ?? 5)

export const finalGrade = (attempts: QuizAttempt[], s: QuizSettings) => {
  const done = attempts.filter((a) => a.score !== null)
  if (!done.length) return null
  const scores = done.map((a) => pct(a) * s.maxGrade)
  if (s.gradingMethod === 'Highest grade') return Math.max(...scores)
  if (s.gradingMethod === 'Average grade') return scores.reduce((x, y) => x + y, 0) / scores.length
  if (s.gradingMethod === 'First attempt') return scores[0]
  return scores[scores.length - 1]
}

export function QuizView({ a }: { a: Activity }) {
  const me = useMe()
  const s = { ...quizDefaults(), ...(a.quiz ?? {}) }
  const [tab, setTab] = useState<'info' | 'results' | 'analytics' | 'settings'>('info')
  if (!me.teacher) return <StudentQuiz a={a} s={s} />
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {([['info', 'Quiz', Eye], ['results', 'Results', BarChart3], ['analytics', 'Analytics', PieChart], ['settings', 'Settings', Settings2]] as const).map(([k, l, Icon]) => <button key={k} className={`tab flex items-center gap-2 ${tab === k ? 'tab-active' : ''}`} onClick={() => setTab(k)}><Icon size={15} />{l}</button>)}
      </div>
      {tab === 'info' ? <QuizInfo a={a} s={s} /> : tab === 'results' ? <QuizResults a={a} s={s} /> : tab === 'analytics' ? <QuizAnalytics a={a} s={s} /> : <QuizSettingsForm key={a.id} a={a} s={s} />}
    </div>
  )
}

function QuizInfo({ a, s }: { a: Activity; s: QuizSettings }) {
  const now = new Date()
  return (
    <div className="card p-6 text-center space-y-1.5">
      {a.description && <p className="mb-3">{a.description}</p>}
      {s.openDate && <div className="text-sm"><span className="muted">{new Date(s.openDate) > now ? 'Opens:' : 'Opened:'}</span> {fmtDate(s.openDate)}</div>}
      {s.closeDate && <div className="text-sm"><span className="muted">{new Date(s.closeDate) < now ? 'This quiz closed on' : 'Closes:'}</span> {fmtDate(s.closeDate)}</div>}
      <div className="text-sm"><span className="muted">Questions:</span> {s.questionCount > 0 ? s.questionCount : 'All questions in the bank'}{s.shuffleQuestions && ' · randomly selected for each attempt'}</div>
      <div className="text-sm"><span className="muted">Attempts allowed:</span> {s.attemptsAllowed === 0 ? 'Unlimited' : s.attemptsAllowed}</div>
      <div className="text-sm"><span className="muted">Time limit:</span> {s.timeLimitMins} mins</div>
      <div className="text-sm"><span className="muted">Grading method:</span> {s.gradingMethod}</div>
    </div>
  )
}

function StudentQuiz({ a, s }: { a: Activity; s: QuizSettings }) {
  const me = useMe()
  const attempts = (useActivityStore((st) => st.attempts[a.id]) ?? EMPTY).filter((x) => x.userId === me.id)
  const start = useActivityStore((st) => st.startAttempt)
  const finish = useActivityStore((st) => st.finishAttempt)
  const [active, setActive] = useState<QuizAttempt | null>(null)
  const [review, setReview] = useState<AttemptReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmStart, setConfirmStart] = useState(false)
  const block = useBlockState(useCourseIdOfActivity(a.id))
  const now = new Date()
  const notOpen = s.openDate && now < new Date(s.openDate)
  const closed = s.closeDate && now > new Date(s.closeDate)
  const finished = attempts.filter((x) => x.finishedAt)
  const inProgress = attempts.some((x) => !x.finishedAt)
  const left = s.attemptsAllowed === 0 ? Infinity : s.attemptsAllowed - finished.length
  const reviewAllowed = (x: QuizAttempt) => !!x.finishedAt && s.reviewAfterClose
  const grade = finalGrade(attempts, s)

  const begin = async () => {
    setConfirmStart(false); setLoading(true)
    const att = await start(a.id)
    setLoading(false)
    if (att) setActive(att)
  }
  const openReview = async (x: QuizAttempt) => {
    setLoading(true)
    try { setReview(await getReview(x.id)) } catch (e) { toast(errorMessage(e), 'error') } finally { setLoading(false) }
  }

  if (active) return <Attempt quiz={s} attempt={active} onFinish={(ans) => { const id = active.id; setActive(null); void finish(a.id, id, ans).then(() => toast('Attempt submitted')) }} />
  if (review) return <Review review={review} onClose={() => setReview(null)} s={s} />

  return (
    <div className="space-y-6">
      <QuizInfo a={a} s={s} />
      {finished.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}>Summary of your previous attempts</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-5 py-3">Attempt</th><th className="px-5 py-3">State</th><th className="px-5 py-3">Marks</th><th className="px-5 py-3">Grade / {s.maxGrade.toFixed(2)}</th><th className="px-5 py-3">Review</th></tr></thead>
            <tbody>
              {finished.map((x, i) => (
                <tr key={x.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-5 py-3">{i + 1}</td>
                  <td className="px-5 py-3"><span className="font-medium" style={{ color: 'var(--color-heading)' }}>Finished</span><div className="text-xs muted">Submitted {fmtDate(x.finishedAt)}</div></td>
                  <td className="px-5 py-3">{x.score}/{x.maxScore ?? 5}</td>
                  <td className="px-5 py-3 font-semibold" style={{ color: 'var(--color-heading)' }}>{(pct(x) * s.maxGrade).toFixed(2)}</td>
                  <td className="px-5 py-3">{reviewAllowed(x) ? <button className="btn btn-secondary btn-sm" disabled={loading} onClick={() => void openReview(x)}>Review</button> : <span className="muted">Not permitted</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {grade !== null && <div className="px-5 py-4 border-t text-center font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}>Your final grade for this quiz is {grade.toFixed(2)}/{s.maxGrade.toFixed(2)}.</div>}
        </div>
      )}
      <div className="text-center space-y-2">
        {block.blocked ? <p style={{ color: 'var(--color-red)' }}>Quiz attempts are restricted by the Assistant Registrar: {block.reason}</p> : notOpen ? <p className="muted">This quiz will not be available until {fmtDate(s.openDate)}</p>
          : closed ? <p className="muted">This quiz has closed.</p>
          : left <= 0 ? <p className="muted">No more attempts are allowed</p>
          : <button className="btn btn-primary" disabled={loading} onClick={() => (inProgress ? void begin() : setConfirmStart(true))}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {inProgress ? 'Continue your attempt' : finished.length ? 'Re-attempt quiz' : 'Attempt quiz now'}</button>}
      </div>
      <Modal open={confirmStart} title="Start attempt" onClose={() => setConfirmStart(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setConfirmStart(false)}>Cancel</button><button className="btn btn-primary" onClick={() => void begin()}>Start attempt</button></>}>
        <p className="text-sm"><b>Time limit</b></p>
        <p className="text-sm mt-1">Your attempt will have a time limit of {s.timeLimitMins} mins. When you start, the timer will begin to count down and cannot be paused. You must finish your attempt before it expires. Are you sure that you wish to start now?</p>
      </Modal>
    </div>
  )
}

function Attempt({ quiz, attempt, onFinish }: { quiz: QuizSettings; attempt: QuizAttempt; onFinish: (a: Record<string, number>) => void }) {
  const questions = attempt.questions ?? []
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [flags, setFlags] = useState<Record<number, boolean>>({})
  const deadline = new Date(attempt.startedAt).getTime() + quiz.timeLimitMins * 60_000
  const [secs, setSecs] = useState(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
  const [confirm, setConfirm] = useState(false)
  const latest = useRef(answers)
  latest.current = answers
  const done = useRef(false)
  const submit = (a: Record<string, number>) => { if (done.current) return; done.current = true; onFinish(a) }
  useEffect(() => {
    const t = setInterval(() => { const r = Math.max(0, Math.round((deadline - Date.now()) / 1000)); setSecs(r); if (r === 0) { clearInterval(t); submit(latest.current) } }, 1000)
    return () => clearInterval(t)
  }, [deadline]) // eslint-disable-line react-hooks/exhaustive-deps
  const unanswered = questions.filter((q) => answers[q.id] === undefined).length
  return (
    <div className="grid lg:grid-cols-[1fr_250px] gap-6">
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} id={`q${i}`} className="card p-6 scroll-mt-24">
            <div className="flex items-center gap-3 text-xs font-semibold muted mb-1">Question {i + 1} of {questions.length} · {answers[q.id] !== undefined ? 'Answer saved' : 'Not yet answered'} · Marked out of 1.00
              <button className="ml-auto badge badge-gray" onClick={() => setFlags({ ...flags, [q.id]: !flags[q.id] })} style={flags[q.id] ? { background: 'var(--color-amber-soft)', color: 'var(--color-amber)' } : {}}>{flags[q.id] ? 'Remove flag' : 'Flag question'}</button>
            </div>
            <div className="font-semibold mb-4" style={{ color: 'var(--color-heading)' }}>{q.text}</div>
            <div className="space-y-2">{q.options.map((o, j) => (
              <label key={j} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${answers[q.id] === j ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-bg-subtle)]'}`} style={{ borderColor: answers[q.id] === j ? undefined : 'var(--color-border)' }}>
                <input type="radio" name={`q${q.id}`} checked={answers[q.id] === j} onChange={() => setAnswers((p) => ({ ...p, [q.id]: j }))} className="accent-[var(--color-primary)]" />
                <span className="text-sm">{String.fromCharCode(97 + j)}. {o}</span>
              </label>
            ))}</div>
            {answers[q.id] !== undefined && <button className="text-xs mt-3 font-semibold" style={{ color: 'var(--color-link)' }} onClick={() => setAnswers((p) => { const n = { ...p }; delete n[q.id]; return n })}>Clear my choice</button>}
          </div>
        ))}
      </div>
      <div className="card p-5 h-fit sticky top-24 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold muted"><Timer size={14} /> Time left</div>
        <div className="text-3xl font-bold tabular-nums" style={{ color: secs < 300 ? 'var(--color-red)' : 'var(--color-heading)' }}>{Math.floor(secs / 3600) ? `${Math.floor(secs / 3600)}:` : ''}{String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</div>
        <div className="text-xs font-semibold muted">Quiz navigation · {questions.length - unanswered}/{questions.length} answered</div>
        <div className="flex flex-wrap gap-2">{questions.map((q, i) => <a key={q.id} href={`#q${i}`} className="relative w-9 h-10 rounded-lg grid place-items-center text-sm font-semibold" style={{ background: answers[q.id] !== undefined ? 'var(--color-primary)' : 'var(--color-bg-subtle)', color: answers[q.id] !== undefined ? '#fff' : 'var(--color-heading)' }}>{i + 1}{flags[q.id] && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: 'var(--color-amber)' }} />}</a>)}</div>
        <button className="btn btn-primary w-full" onClick={() => setConfirm(true)}>Finish attempt…</button>
      </div>
      <Modal open={confirm} title="Summary of attempt" onClose={() => setConfirm(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setConfirm(false)}>Return to attempt</button><button className="btn btn-primary" onClick={() => submit(answers)}>Submit all and finish</button></>}>
        <div className="max-h-72 overflow-y-auto mb-4">
          <table className="w-full text-sm"><tbody>{questions.map((q, i) => <tr key={q.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="py-2">Question {i + 1}{flags[q.id] && <span className="badge badge-amber ml-2">Flagged</span>}</td><td className="py-2 text-right">{answers[q.id] !== undefined ? 'Answer saved' : <span style={{ color: 'var(--color-red)' }}>Not yet answered</span>}</td></tr>)}</tbody></table>
        </div>
        <p className="text-sm">Once you submit all your answers, you will no longer be able to change them. {unanswered > 0 && <b>You have {unanswered} unanswered question(s).</b>}</p>
      </Modal>
    </div>
  )
}

function Review({ review, onClose, s }: { review: AttemptReview; onClose: () => void; s: QuizSettings }) {
  const mins = review.finishedAt ? Math.max(0, Math.round((new Date(review.finishedAt).getTime() - new Date(review.startedAt).getTime()) / 60000)) : 0
  const ratio = (review.score ?? 0) / Math.max(1, review.maxScore)
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card overflow-hidden">
        {[['Started on', fmtDate(review.startedAt)], ['State', 'Finished'], ['Completed on', fmtDate(review.finishedAt)], ['Time taken', mins < 1 ? 'Less than a minute' : `${mins} min`], ['Marks', `${(review.score ?? 0).toFixed(2)}/${review.maxScore.toFixed(2)}`], ['Grade', `${(ratio * s.maxGrade).toFixed(2)} out of ${s.maxGrade.toFixed(2)} (${Math.round(ratio * 100)}%)`]].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[160px_1fr] border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}><div className="px-5 py-3 text-sm font-semibold" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-heading)' }}>{k}</div><div className="px-5 py-3 text-sm">{v}</div></div>
        ))}
      </div>
      {review.questions.length === 0 && <div className="card p-6 text-sm muted">This attempt was made before the question bank was introduced, so its questions cannot be shown.</div>}
      {review.questions.map((q, i) => {
        const ok = q.chosen === q.correct
        return (
          <div key={q.id} className="card p-5" style={{ borderLeft: `4px solid ${ok ? 'var(--color-green)' : 'var(--color-red)'}` }}>
            <div className="text-xs font-semibold muted">Question {i + 1} · {ok ? 'Correct' : q.chosen < 0 ? 'Not answered' : 'Incorrect'} · Mark {ok ? '1.00' : '0.00'} out of 1.00</div>
            <div className="font-semibold mt-1 mb-3" style={{ color: 'var(--color-heading)' }}>{q.text}</div>
            <div className="space-y-1.5">
              {q.options.map((o, j) => (
                <div key={j} className="text-sm px-3 py-2 rounded-lg" style={{ background: j === q.correct ? 'var(--color-green-soft)' : j === q.chosen ? 'var(--color-red-soft)' : 'transparent', color: j === q.correct ? 'var(--color-green)' : j === q.chosen ? 'var(--color-red)' : 'var(--color-text)', fontWeight: j === q.correct || j === q.chosen ? 600 : 400 }}>
                  {String.fromCharCode(97 + j)}. {o}{j === q.chosen && ' — your answer'}{j === q.correct && ' ✓'}
                </div>
              ))}
            </div>
            {q.explanation && <p className="text-sm muted mt-3">{q.explanation}</p>}
          </div>
        )
      })}
      <button className="btn btn-secondary" onClick={onClose}>Finish review</button>
    </div>
  )
}

function QuizResults({ a, s }: { a: Activity; s: QuizSettings }) {
  const STUDENTS = useEnrolled(useCourseIdOfActivity(a.id))
  const real = useActivityStore((st) => st.attempts[a.id]) ?? EMPTY
  const rows = STUDENTS.map((st) => {
    const mine = real.filter((x) => x.userId === st.id && x.finishedAt)
    return { st, attempts: mine.length, inProgress: real.some((x) => x.userId === st.id && !x.finishedAt), grade: mine.length ? finalGrade(mine, s) : null }
  })
  const graded = rows.filter((r) => r.grade !== null)
  const avg = graded.length ? graded.reduce((n, r) => n + r.grade!, 0) / graded.length : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[['Students attempted', graded.length], ['Average grade', avg.toFixed(2)], ['Not attempted', rows.length - graded.length]].map(([l, v]) => <div key={l} className="card p-5"><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{v}</div><div className="text-xs muted">{l}</div></div>)}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-5 py-3">Student</th><th className="px-5 py-3">Attempts</th><th className="px-5 py-3">Grade / {s.maxGrade.toFixed(2)}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.st.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="px-5 py-3 font-medium" style={{ color: 'var(--color-heading)' }}>{r.st.name}</td><td className="px-5 py-3">{r.attempts}{r.inProgress && <span className="badge badge-blue ml-2">In progress</span>}</td><td className="px-5 py-3">{r.grade === null ? <span className="muted">-</span> : <span className={`badge ${r.grade / s.maxGrade >= 0.5 ? 'badge-green' : 'badge-red'}`}>{r.grade.toFixed(2)}</span>}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

function QuizSettingsForm({ a, s }: { a: Activity; s: QuizSettings }) {
  const update = useLmsStore((st) => st.updateActivity)
  const courseId = useCourseIdOfActivity(a.id)
  const { data: bank, isLoading } = useQuestionBank(courseId)
  const [v, setV] = useState(s)
  const [err, setErr] = useState('')
  const categories = useMemo(() => [...new Set((bank ?? []).map((q) => q.category))].sort(), [bank])
  const available = (bank ?? []).filter((q) => v.category === 'All' || q.category === v.category).length
  const save = () => {
    if (v.openDate && v.closeDate && v.closeDate <= v.openDate) return setErr('You have specified a close date before the open date.')
    if (v.timeLimitMins < 1) return setErr('Time limit must be at least 1 minute.')
    if (v.questionCount < 0) return setErr('Number of questions cannot be negative.')
    if (bank && available === 0) return setErr('The selected category has no questions. Add questions to the question bank first.')
    if (bank && v.questionCount > available) return setErr(`Only ${available} question(s) are available in this category. Reduce the number of questions or add more to the bank.`)
    setErr(''); update(a.id, { quiz: v }); toast('Changes saved')
  }
  return (
    <div className="space-y-6">
      <section className="card p-6 space-y-5">
        <h2 className="font-bold text-lg">Timing & attempts</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="form-label">Open the quiz</label><input type="datetime-local" className="form-control" value={toLocalInput(v.openDate)} onChange={(e) => setV({ ...v, openDate: fromLocalInput(e.target.value) })} /></div>
          <div><label className="form-label">Close the quiz</label><input type="datetime-local" className="form-control" value={toLocalInput(v.closeDate)} onChange={(e) => setV({ ...v, closeDate: fromLocalInput(e.target.value) })} /></div>
          <div><label className="form-label">Time limit (minutes)</label><input type="number" min={1} className="form-control" value={v.timeLimitMins} onChange={(e) => setV({ ...v, timeLimitMins: Number(e.target.value) })} /></div>
          <div><label className="form-label">Attempts allowed</label><select className="form-control" value={v.attemptsAllowed} onChange={(e) => setV({ ...v, attemptsAllowed: Number(e.target.value) })}><option value={0}>Unlimited</option>{[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div><label className="form-label">Grading method</label><select className="form-control" value={v.gradingMethod} onChange={(e) => setV({ ...v, gradingMethod: e.target.value as QuizSettings['gradingMethod'] })}>{['Highest grade', 'Average grade', 'First attempt', 'Last attempt'].map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className="form-label">Maximum grade</label><input type="number" min={1} className="form-control" value={v.maxGrade} onChange={(e) => setV({ ...v, maxGrade: Math.max(1, Number(e.target.value)) })} /></div>
        </div>
        <label className="flex items-center justify-between gap-4"><span><span className="form-label !mb-0">Allow students to review their attempts</span><span className="text-xs muted block">Shows correct answers and explanations in the attempt review</span></span><button className="switch" data-on={v.reviewAfterClose} onClick={() => setV({ ...v, reviewAfterClose: !v.reviewAfterClose })} aria-label="Allow review" /></label>
      </section>

      <section className="card p-6 space-y-5">
        <div className="flex items-center gap-2"><Database size={18} style={{ color: 'var(--color-primary)' }} /><h2 className="font-bold text-lg mr-auto">Questions from the question bank</h2>
          <span className="badge badge-blue">{isLoading ? 'Loading…' : `${available} available`}</span></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Draw questions from</label>
            <select className="form-control" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
              <option value="All">All categories ({bank?.length ?? 0})</option>
              {categories.map((c) => <option key={c} value={c}>{c} ({(bank ?? []).filter((q) => q.category === c).length})</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Questions per attempt</label>
            <input type="number" min={0} max={available || undefined} className="form-control" value={v.questionCount} onChange={(e) => setV({ ...v, questionCount: Math.max(0, Number(e.target.value)) })} />
            <p className="text-xs muted mt-1">{v.questionCount === 0 ? 'Every matching question will be used.' : `Each student gets ${v.questionCount} of ${available} questions chosen at random.`}</p>
          </div>
        </div>
        <label className="flex items-center justify-between gap-4"><span className="flex items-start gap-3"><Shuffle size={18} className="muted mt-0.5" /><span><span className="form-label !mb-0">Shuffle question order</span><span className="text-xs muted block">Questions appear in a different order for each student</span></span></span><button className="switch" data-on={v.shuffleQuestions} onClick={() => setV({ ...v, shuffleQuestions: !v.shuffleQuestions })} aria-label="Shuffle questions" /></label>
        <label className="flex items-center justify-between gap-4"><span className="flex items-start gap-3"><Shuffle size={18} className="muted mt-0.5" /><span><span className="form-label !mb-0">Shuffle answer options</span><span className="text-xs muted block">Answer options appear in a different order for each student</span></span></span><button className="switch" data-on={v.shuffleAnswers} onClick={() => setV({ ...v, shuffleAnswers: !v.shuffleAnswers })} aria-label="Shuffle answers" /></label>
        <p className="text-xs muted">Changes apply to new attempts. Attempts already started keep the paper they received.</p>
      </section>

      {err && <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--color-red-soft)', color: 'var(--color-red)' }}>{err}</div>}
      <button className="btn btn-primary" onClick={save}><Save size={16} /> Save and display</button>
    </div>
  )
}
