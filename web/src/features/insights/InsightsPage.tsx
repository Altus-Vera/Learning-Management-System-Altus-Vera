import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AlertTriangle, ShieldAlert, ShieldCheck, Activity, Search, ChevronDown, Send, TrendingDown, TrendingUp, Minus, RefreshCw, Users, FileWarning, Ban, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from 'recharts'
import { useRole } from '../../store/uiStore'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { errorMessage, loadBootstrap } from '../../services/sync'
import { useAtRisk, useRefreshInsights, notifyStudent, LEVEL_TONE, type StudentRisk, type RiskLevel } from './insightsApi'

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string | number; tone: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className="w-12 h-12 rounded-2xl grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon size={22} /></span>
      <div><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{value}</div><div className="text-xs font-medium muted">{label}</div></div>
    </div>
  )
}

export function RiskBar({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-subtle)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(4, score)}%`, background: LEVEL_TONE[level].color }} /></div>
      <span className="text-sm font-bold w-8 text-right" style={{ color: LEVEL_TONE[level].color }}>{score}</span>
    </div>
  )
}

const trendIcon = (t: number[]) => {
  if (t.length < 2) return <Minus size={14} className="muted" />
  const d = t[t.length - 1] - t[0]
  return d > 5 ? <TrendingUp size={14} style={{ color: 'var(--color-green)' }} /> : d < -5 ? <TrendingDown size={14} style={{ color: 'var(--color-red)' }} /> : <Minus size={14} className="muted" />
}

export default function InsightsPage() {
  const { isTeacher, role } = useRole()
  const { data, isLoading, error, refetch, isFetching } = useAtRisk(isTeacher)
  const refresh = useRefreshInsights()
  const [course, setCourse] = useState(0)
  const [level, setLevel] = useState<'all' | RiskLevel>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [msgFor, setMsgFor] = useState<StudentRisk | null>(null)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  const rows = useMemo(() => (data?.students ?? []).filter((s) => (!course || s.courseId === course) && (level === 'all' || s.level === level) && `${s.name} ${s.indexNo ?? ''}`.toLowerCase().includes(q.toLowerCase())), [data, course, level, q])
  const scoped = useMemo(() => (data?.students ?? []).filter((s) => !course || s.courseId === course), [data, course])
  const dist = useMemo(() => {
    const bands = ['0–39', '40–49', '50–59', '60–69', '70–79', '80–100']
    const band = (g: number) => (g < 40 ? 0 : g < 50 ? 1 : g < 60 ? 2 : g < 70 ? 3 : g < 80 ? 4 : 5)
    const counts = bands.map(() => 0)
    scoped.forEach((s) => { if (s.avgGrade !== null) counts[band(s.avgGrade)]++ })
    return bands.map((b, i) => ({ band: b, count: counts[i] }))
  }, [scoped])

  if (!isTeacher) return <Navigate to="/insights/me" replace />

  const openMessage = (s: StudentRisk) => {
    const first = s.name.split(' ')[0]
    setMsg(`Dear ${first},\n\nI noticed you may need some support in ${s.courseName.split('-')[0]}: ${s.reasons.slice(0, 2).join('; ').toLowerCase()}.\n\nPlease meet me during consultation hours or reply to this message so we can plan the next steps together.\n\nBest regards`)
    setMsgFor(s)
  }
  const send = async () => {
    if (!msgFor || !msg.trim()) return
    setSending(true)
    try {
      await notifyStudent(msgFor.studentId, msgFor.courseId, msg.trim())
      toast(`Support message sent to ${msgFor.name}`)
      setMsgFor(null)
      void loadBootstrap()
      refresh()
    } catch (e) { toast(errorMessage(e), 'error') } finally { setSending(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-primary)' }}>{role === 'Admin' ? 'Assistant Registrar' : 'Lecturer'} · Early warning</div>
          <h1 className="text-2xl font-bold">Student insights</h1>
          <p className="text-sm muted">Students are ranked by a risk score built from grades, missing and late work, quiz results, activity and completion.</p>
        </div>
        <select className="form-control !w-auto" value={course} onChange={(e) => setCourse(Number(e.target.value))}>
          <option value={0}>All my courses</option>
          {data?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => void refetch()} disabled={isFetching}><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {isLoading ? <div className="card p-12 text-center muted">Analysing student performance…</div> : error ? (
        <div className="card p-10 text-center"><AlertTriangle size={32} className="mx-auto" style={{ color: 'var(--color-red)' }} /><p className="mt-2">{errorMessage(error)}</p><button className="btn btn-primary mt-4" onClick={() => void refetch()}>Try again</button></div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat icon={ShieldAlert} label="High risk" value={scoped.filter((s) => s.level === 'High').length} tone="#DC2626" />
            <Stat icon={AlertTriangle} label="Medium risk" value={scoped.filter((s) => s.level === 'Medium').length} tone="#D97706" />
            <Stat icon={ShieldCheck} label="On track" value={scoped.filter((s) => s.level === 'Low').length} tone="#16A34A" />
            <Stat icon={FileWarning} label="Missing submissions" value={scoped.reduce((n, s) => n + s.missing, 0)} tone="#0033A0" />
          </div>

          <div className="grid xl:grid-cols-[1fr_380px] gap-6">
            <section className="card p-5">
              <h2 className="font-bold mb-1">Grade distribution</h2>
              <p className="text-xs muted mb-4">Average assignment grade per student-course enrolment</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dist} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="band" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--color-bg-subtle)' }} contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }} />
                    <Bar dataKey="count" name="Students" radius={[8, 8, 0, 0]}>
                      {dist.map((d, i) => <Cell key={d.band} fill={i < 2 ? '#DC2626' : i === 2 ? '#D97706' : '#0033A0'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card p-5">
              <h2 className="font-bold mb-1">Why students are struggling</h2>
              <p className="text-xs muted mb-4">Most common reasons among medium and high risk students</p>
              {data.summary.topReasons.length === 0 ? <p className="text-sm muted">No concerns detected.</p> : (
                <div className="space-y-3">
                  {data.summary.topReasons.map((r) => {
                    const max = data.summary.topReasons[0].count
                    return (
                      <div key={r.reason}>
                        <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--color-heading)' }}>{r.reason}</span><span className="font-semibold">{r.count}</span></div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-subtle)' }}><div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: 'var(--color-primary)' }} /></div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="font-bold mr-auto">Priority list</h2>
              <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9 !h-9 !w-56" placeholder="Search student" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <div className="flex p-1 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
                {(['all', 'High', 'Medium', 'Low'] as const).map((l) => <button key={l} onClick={() => setLevel(l)} className={`h-7 px-3 rounded-lg text-xs font-semibold ${level === l ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'muted'}`}>{l === 'all' ? 'All' : l}</button>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
                  <th className="px-4 py-3">Student</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Avg grade</th><th className="px-4 py-3">Missing</th><th className="px-4 py-3">Quiz avg</th><th className="px-4 py-3">Last active</th><th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {rows.map((s) => {
                    const key = `${s.studentId}:${s.courseId}`
                    const isOpen = open === key
                    return (
                      <FragmentRow key={key} s={s} isOpen={isOpen} onToggle={() => setOpen(isOpen ? null : key)} onMessage={() => openMessage(s)} />
                    )
                  })}
                  {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center muted">No students match the filters</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Modal open={!!msgFor} title={`Send support message · ${msgFor?.name ?? ''}`} onClose={() => setMsgFor(null)} width={600}
        footer={<><button className="btn btn-secondary" onClick={() => setMsgFor(null)}>Cancel</button><button className="btn btn-primary" disabled={sending || !msg.trim()} onClick={() => void send()}><Send size={15} /> {sending ? 'Sending…' : 'Send message'}</button></>}>
        <p className="text-sm muted mb-3">The student receives this in Messages and as a notification. The action is recorded in the audit log.</p>
        <textarea rows={9} className="form-control" value={msg} onChange={(e) => setMsg(e.target.value)} />
      </Modal>
    </div>
  )
}

function FragmentRow({ s, isOpen, onToggle, onMessage }: { s: StudentRisk; isOpen: boolean; onToggle: () => void; onMessage: () => void }) {
  return (
    <>
      <tr className="border-t hover:bg-[var(--color-bg-card-hover)] cursor-pointer" style={{ borderColor: 'var(--color-border)' }} onClick={onToggle}>
        <td className="px-4 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{s.name}</div><div className="text-xs muted">{s.indexNo}</div></td>
        <td className="px-4 py-3 muted">{s.courseName.split('-')[0]}</td>
        <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={`badge ${LEVEL_TONE[s.level].badge}`}>{s.level}</span><RiskBar score={s.riskScore} level={s.level} /></div></td>
        <td className="px-4 py-3"><span className="flex items-center gap-1.5">{s.avgGrade === null ? <span className="muted">Not graded</span> : <><b style={{ color: s.avgGrade < 50 ? 'var(--color-red)' : 'var(--color-heading)' }}>{s.avgGrade}%</b>{trendIcon(s.gradeTrend)}</>}</span></td>
        <td className="px-4 py-3">{s.missing > 0 ? <span className="badge badge-red">{s.missing}</span> : <span className="muted">0</span>}</td>
        <td className="px-4 py-3">{s.quizAvg === null ? <span className="muted">-</span> : `${s.quizAvg}%`}</td>
        <td className="px-4 py-3 muted whitespace-nowrap">{s.daysSinceAccess === null ? 'Never' : s.daysSinceAccess === 0 ? 'Today' : `${s.daysSinceAccess}d ago`}</td>
        <td className="px-4 py-3 text-right"><ChevronDown size={16} className={`muted transition-transform ${isOpen ? 'rotate-180' : ''}`} /></td>
      </tr>
      {isOpen && (
        <tr style={{ background: 'var(--color-bg-subtle)' }}>
          <td colSpan={8} className="px-4 py-5">
            <div className="grid lg:grid-cols-3 gap-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider muted mb-2">Why this student is flagged</div>
                <ul className="space-y-1.5 text-sm">{s.reasons.map((r) => <li key={r} className="flex gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: s.level === 'Low' ? 'var(--color-green)' : LEVEL_TONE[s.level].color }} />{r}</li>)}</ul>
                <div className="flex flex-wrap gap-2 mt-3">
                  {s.blocked && <span className="badge badge-red"><Ban size={12} /> Blocked</span>}
                  {s.paymentDue && <span className="badge badge-amber"><Wallet size={12} /> Payment overdue</span>}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider muted mb-2">Breakdown</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="card p-3"><div className="muted text-xs">Submitted</div><b style={{ color: 'var(--color-heading)' }}>{s.submitted}</b></div>
                  <div className="card p-3"><div className="muted text-xs">Due so far</div><b style={{ color: 'var(--color-heading)' }}>{s.dueSoFar}</b></div>
                  <div className="card p-3"><div className="muted text-xs">Late</div><b style={{ color: 'var(--color-heading)' }}>{s.late}</b></div>
                  <div className="card p-3"><div className="muted text-xs">Completion</div><b style={{ color: 'var(--color-heading)' }}>{s.completion}%</b></div>
                </div>
                {s.gradeTrend.length > 1 && (
                  <div className="h-20 mt-3 card p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={s.gradeTrend.map((g, i) => ({ i: i + 1, g }))}><YAxis hide domain={[0, 100]} /><Tooltip formatter={(v) => `${v}%`} labelFormatter={(l) => `Graded item ${l}`} contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 10 }} /><Line type="monotone" dataKey="g" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} /></LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider muted mb-2">Recommended actions</div>
                {s.actions.length === 0 ? <p className="text-sm muted">No action needed.</p> : <ul className="space-y-1.5 text-sm list-disc pl-5">{s.actions.map((a) => <li key={a}>{a}</li>)}</ul>}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onMessage() }}><Send size={14} /> Send support message</button>
                  <Link to={`/courses/${s.courseId}?tab=grades`} className="btn btn-secondary btn-sm !text-[var(--color-heading)]" onClick={(e) => e.stopPropagation()}><Activity size={14} /> View grades</Link>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
