import { useMemo, useState } from 'react'
import { Users, CheckCircle2, Clock3, AlertTriangle, GraduationCap, Send, BellRing, Percent, CalendarPlus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { eachDayOfInterval, format, formatDistanceStrict, startOfDay } from 'date-fns'
import { useLmsStore, type Activity, type Submission } from '../../../store/lmsStore'
import { useAdminStore, useEnrolled, useCourseIdOfActivity } from '../../../store/adminStore'
import { notifyStudent } from '../../insights/insightsApi'
import { errorMessage, loadBootstrap } from '../../../services/sync'
import { toast } from '../../../components/Toast'
import { Modal } from '../../../components/Modal'
import { fmtShort } from '../../../lib/format'

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
const stdDev = (xs: number[]) => { if (xs.length < 2) return null; const mean = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((n, x) => n + (x - mean) ** 2, 0) / (xs.length - 1)) }

export function AssignmentAnalytics({ a, onOpenSubmissions }: { a: Activity; onOpenSubmissions: () => void }) {
  const s = a.assign!
  const courseId = useCourseIdOfActivity(a.id)
  const students = useEnrolled(courseId)
  const submissions = useLmsStore((x) => x.submissions)
  const extensions = useAdminStore((x) => x.extensions)
  const [remind, setRemind] = useState<{ ids: string[]; message: string } | null>(null)
  const [sending, setSending] = useState(false)

  const now = new Date()
  const due = s.dueDate ? new Date(s.dueDate) : null
  const cut = s.cutOffDate ? new Date(s.cutOffDate) : null
  const pastDue = !!due && now > due

  const data = useMemo(() => {
    const rows = students.map((st) => {
      const sub: Submission | undefined = submissions[`${a.id}:${st.id}`]
      const submitted = sub?.status === 'submitted'
      const at = sub?.modifiedAt ? new Date(sub.modifiedAt) : null
      const late = submitted && !!due && !!at && at > due
      const ext = extensions[`${a.id}:${st.id}`] ?? null
      const pct = sub?.grade != null && s.maxGrade > 0 ? (sub.grade / s.maxGrade) * 100 : null
      return { st, sub, submitted, late, at, ext, pct, draft: sub?.status === 'draft' }
    })
    const submitted = rows.filter((r) => r.submitted)
    const onTime = submitted.filter((r) => !r.late)
    const late = submitted.filter((r) => r.late)
    const drafts = rows.filter((r) => r.draft)
    const missing = rows.filter((r) => !r.submitted)
    const graded = rows.filter((r) => r.pct !== null)
    const toGrade = submitted.filter((r) => r.sub?.grade == null)
    const pcts = graded.map((r) => r.pct!)
    const mean = pcts.length ? pcts.reduce((x, y) => x + y, 0) / pcts.length : null

    const bands = ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80–89', '90–100']
    const dist = bands.map((band, i) => ({ band, count: pcts.filter((p) => (i === 9 ? p >= 90 : p >= i * 10 && p < i * 10 + 10)).length, pass: i >= 5 }))

    const status = [
      { name: 'On time', value: onTime.length, color: '#16A34A' },
      { name: 'Late', value: late.length, color: '#D97706' },
      { name: 'Draft', value: drafts.length, color: '#6366F1' },
      { name: 'Not started', value: rows.length - submitted.length - drafts.length, color: '#CBD5E1' },
    ].filter((x) => x.value > 0)

    const times = submitted.map((r) => r.at!).filter(Boolean)
    const start = s.allowSubmissionsFrom ? new Date(s.allowSubmissionsFrom) : times.length ? new Date(Math.min(...times.map((t) => t.getTime()))) : now
    const endCandidate = new Date(Math.max(now.getTime(), ...(times.map((t) => t.getTime()))))
    const end = cut && endCandidate > cut ? new Date(Math.max(cut.getTime(), ...times.map((t) => t.getTime()))) : endCandidate
    const days = start <= end ? eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) }).slice(-60) : []
    const timeline = days.map((d) => {
      const endOfDay = new Date(d.getTime() + 86_400_000)
      return { day: format(d, 'd MMM'), ts: d.getTime(), submitted: times.filter((t) => t < endOfDay).length }
    })

    return { rows, submitted, onTime, late, drafts, missing, graded, toGrade, pcts, mean, dist, status, timeline }
  }, [students, submissions, extensions, a.id, s, due, cut]) // eslint-disable-line react-hooks/exhaustive-deps

  const rate = students.length ? Math.round((data.submitted.length / students.length) * 100) : 0
  const passRate = data.pcts.length ? Math.round((data.pcts.filter((p) => p >= 50).length / data.pcts.length) * 100) : null
  const med = median(data.pcts)
  const sd = stdDev(data.pcts)
  const dueLabel = due ? format(due, 'd MMM') : null
  const cutLabel = cut ? format(cut, 'd MMM') : null

  const openRemind = (ids: string[]) => setRemind({
    ids,
    message: `Reminder: “${a.name}” ${pastDue ? 'was due' : 'is due'} on ${due ? format(due, 'EEEE, d MMMM yyyy, h:mm a') : 'the due date'}${cut && now < cut ? `. Submissions close on ${format(cut, 'd MMMM, h:mm a')}` : ''}. Please submit your work as soon as possible, or contact me if you need help or an extension.`,
  })
  const sendReminders = async () => {
    if (!remind || !courseId) return
    setSending(true)
    let sent = 0
    for (const id of remind.ids) {
      try { await notifyStudent(id, courseId, remind.message); sent++ } catch (e) { toast(errorMessage(e), 'error') }
    }
    setSending(false)
    setRemind(null)
    if (sent) { toast(`Reminder sent to ${sent} student${sent > 1 ? 's' : ''}`); void loadBootstrap() }
  }

  if (!students.length) return <div className="card p-12 text-center muted">No students are enrolled in this course yet.</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={Users} label="Submission rate" value={`${rate}%`} sub={`${data.submitted.length} of ${students.length} students`} tone="#0033A0" />
        <Stat icon={CheckCircle2} label="On time / late" value={`${data.onTime.length} / ${data.late.length}`} sub={data.drafts.length ? `${data.drafts.length} draft(s) not submitted` : undefined} tone="#16A34A" />
        <Stat icon={Clock3} label="Awaiting grading" value={data.toGrade.length} sub={`${data.graded.length} graded`} tone="#D97706" />
        <Stat icon={GraduationCap} label="Average grade" value={data.mean === null ? '-' : `${data.mean.toFixed(1)}%`} sub={passRate === null ? 'No grades yet' : `${passRate}% pass rate`} tone="#7C3AED" />
      </div>

      <div className="grid xl:grid-cols-[340px_1fr] gap-6">
        <section className="card p-5">
          <h2 className="font-bold mb-1">Submission status</h2>
          <p className="text-xs muted mb-2">All enrolled students</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.status} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {data.status.map((x) => <Cell key={x.name} fill={x.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold mb-1">Submissions over time</h2>
          <p className="text-xs muted mb-2">Cumulative submissions{dueLabel ? ` · due ${dueLabel}` : ''}{cutLabel ? ` · cut-off ${cutLabel}` : ''}</p>
          <div className="h-60">
            {data.timeline.length < 2 ? <div className="h-full grid place-items-center text-sm muted">Not enough activity to chart yet.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeline} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis allowDecimals={false} domain={[0, students.length]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {dueLabel && data.timeline.some((t) => t.day === dueLabel) && <ReferenceLine x={dueLabel} stroke="#D97706" strokeDasharray="4 4" label={{ value: 'Due', fill: '#D97706', fontSize: 11, position: 'insideTopRight' }} />}
                  {cutLabel && data.timeline.some((t) => t.day === cutLabel) && <ReferenceLine x={cutLabel} stroke="#DC2626" strokeDasharray="4 4" label={{ value: 'Cut-off', fill: '#DC2626', fontSize: 11, position: 'insideTopRight' }} />}
                  <ReferenceLine y={students.length} stroke="var(--color-border-strong)" strokeDasharray="2 2" />
                  <Line type="stepAfter" dataKey="submitted" name="Submitted" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-6">
        <section className="card p-5">
          <h2 className="font-bold mb-1">Grade distribution</h2>
          <p className="text-xs muted mb-2">Percentage of the maximum grade ({s.maxGrade}) · red bars are below the 50% pass mark</p>
          <div className="h-56">
            {data.pcts.length === 0 ? <div className="h-full grid place-items-center text-sm muted">No submissions have been graded yet.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dist} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--color-bg-subtle)' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>{data.dist.map((d) => <Cell key={d.band} fill={d.pass ? '#0033A0' : '#DC2626'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Percent size={16} style={{ color: 'var(--color-primary)' }} /> Grade statistics</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Graded', `${data.graded.length} / ${data.submitted.length}`],
              ['Mean', data.mean === null ? '-' : `${data.mean.toFixed(1)}%`],
              ['Median', med === null ? '-' : `${med.toFixed(1)}%`],
              ['Std. deviation', sd === null ? '-' : sd.toFixed(1)],
              ['Highest', data.pcts.length ? `${Math.max(...data.pcts).toFixed(1)}%` : '-'],
              ['Lowest', data.pcts.length ? `${Math.min(...data.pcts).toFixed(1)}%` : '-'],
              ['Pass rate', passRate === null ? '-' : `${passRate}%`],
              ['Below 50%', String(data.pcts.filter((p) => p < 50).length)],
            ].map(([k, v]) => <div key={k} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}><dt className="text-xs muted">{k}</dt><dd className="font-bold" style={{ color: 'var(--color-heading)' }}>{v}</dd></div>)}
          </dl>
          {data.toGrade.length > 0 && <button className="btn btn-primary btn-sm w-full mt-4" onClick={onOpenSubmissions}>Grade {data.toGrade.length} submission{data.toGrade.length > 1 ? 's' : ''}</button>}
        </section>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-bold mr-auto flex items-center gap-2"><AlertTriangle size={16} style={{ color: 'var(--color-red)' }} /> Not submitted ({data.missing.length})</h2>
            {data.missing.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => openRemind(data.missing.map((r) => r.st.id))}><BellRing size={14} /> Remind all</button>}
          </div>
          {data.missing.length === 0 ? <div className="p-8 text-center text-sm muted">Every enrolled student has submitted. 🎉</div> : (
            <table className="w-full text-sm">
              <tbody>
                {data.missing.map((r) => (
                  <tr key={r.st.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-5 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{r.st.name}</div><div className="text-xs muted">{r.st.indexNo}</div></td>
                    <td className="px-3 py-3">
                      {r.draft ? <span className="badge badge-amber">Draft not submitted</span> : <span className="badge badge-gray">Not started</span>}
                      {r.ext && <span className="badge badge-blue ml-1"><CalendarPlus size={11} /> Extension to {fmtShort(r.ext).split(',')[0]}</span>}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: pastDue ? 'var(--color-red)' : 'var(--color-text-muted)' }}>{due ? (pastDue ? `Overdue by ${formatDistanceStrict(now, due)}` : `Due in ${formatDistanceStrict(due, now)}`) : ''}</td>
                    <td className="px-5 py-3 text-right"><button className="btn btn-ghost btn-sm" onClick={() => openRemind([r.st.id])}><Send size={14} /> Remind</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b font-bold flex items-center gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}><Clock3 size={16} style={{ color: 'var(--color-amber)' }} /> Late submissions ({data.late.length})</div>
          {data.late.length === 0 ? <div className="p-8 text-center text-sm muted">No late submissions.</div> : (
            <table className="w-full text-sm">
              <tbody>
                {[...data.late].sort((x, y) => y.at!.getTime() - x.at!.getTime()).map((r) => (
                  <tr key={r.st.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-5 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{r.st.name}</div><div className="text-xs muted">Submitted {fmtShort(r.at!.toISOString())}</div></td>
                    <td className="px-3 py-3"><span className="badge badge-amber">{formatDistanceStrict(r.at!, due!)} late</span></td>
                    <td className="px-5 py-3 text-right">{r.sub?.grade != null ? <b style={{ color: 'var(--color-heading)' }}>{r.sub.grade}/{s.maxGrade}</b> : <span className="muted text-xs">Not graded</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <Modal open={!!remind} title={`Send reminder to ${remind?.ids.length ?? 0} student${(remind?.ids.length ?? 0) > 1 ? 's' : ''}`} onClose={() => setRemind(null)} width={580}
        footer={<><button className="btn btn-secondary" onClick={() => setRemind(null)}>Cancel</button><button className="btn btn-primary" disabled={sending || !remind?.message.trim()} onClick={() => void sendReminders()}><Send size={15} /> {sending ? 'Sending…' : 'Send reminder'}</button></>}>
        <p className="text-sm muted mb-3">Each student receives the reminder in Messages and as a notification.</p>
        {remind && <textarea rows={6} className="form-control" value={remind.message} onChange={(e) => setRemind({ ...remind, message: e.target.value })} />}
      </Modal>
    </div>
  )
}
