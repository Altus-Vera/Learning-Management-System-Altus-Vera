import { useMemo, useState } from 'react'
import { MessagesSquare, Users, Clock3, HelpCircle, Trophy, UserX, Send, BellRing, Lock, Pin } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { eachDayOfInterval, format, formatDistanceStrict, startOfDay, subDays } from 'date-fns'
import { useActivityStore, type Discussion } from '../../store/activityStore'
import { useLmsStore, type Activity } from '../../store/lmsStore'
import { useEnrolled, useCourseIdOfActivity } from '../../store/adminStore'
import { notifyStudent } from '../insights/insightsApi'
import { errorMessage, loadBootstrap } from '../../services/sync'
import { toast } from '../../components/Toast'
import { Modal } from '../../components/Modal'

const NO_DISCUSSIONS: Discussion[] = []
const tooltipStyle = { background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12 }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Stat({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string | number; sub?: string; tone: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon size={20} /></span>
      <div className="min-w-0"><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{value}</div><div className="text-xs font-medium muted">{label}</div>{sub && <div className="text-[11px] muted">{sub}</div>}</div>
    </div>
  )
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const human = (ms: number | null) => (ms === null ? '-' : formatDistanceStrict(0, ms))

export function ForumAnalytics({ a, onOpenDiscussion }: { a: Activity; onOpenDiscussion: (id: number) => void }) {
  const news = a.name === 'Announcements'
  const discussions = useActivityStore((s) => s.forums[a.id]) ?? NO_DISCUSSIONS
  const courseId = useCourseIdOfActivity(a.id)
  const lecturerId = useLmsStore((s) => s.courses.find((c) => c.id === courseId)?.lecturerId)
  const students = useEnrolled(courseId)
  const [range, setRange] = useState<14 | 30 | 90>(30)
  const [nudge, setNudge] = useState<{ ids: string[]; message: string } | null>(null)
  const [sending, setSending] = useState(false)

  const data = useMemo(() => {
    const studentIds = new Set(students.map((s) => s.id))
    const posts = discussions.flatMap((d) => d.posts.map((p) => ({ ...p, discussion: d })))
    const studentPosts = posts.filter((p) => studentIds.has(p.authorId))
    const isStaff = (id: string) => !studentIds.has(id) || id === lecturerId

    const threads = discussions.map((d) => {
      const first = d.posts.find((p) => p.parentId === null) ?? d.posts[0]
      const replies = d.posts.filter((p) => p !== first).sort((x, y) => x.at.localeCompare(y.at))
      const firstReply = replies[0]
      const staffReply = replies.find((p) => isStaff(p.authorId))
      const byStudent = studentIds.has(d.authorId)
      const last = d.posts.reduce((x, y) => (y.at > x.at ? y : x), first)
      return {
        d, replies: replies.length, byStudent,
        firstReplyMs: firstReply ? new Date(firstReply.at).getTime() - new Date(first.at).getTime() : null,
        staffReplyMs: staffReply ? new Date(staffReply.at).getTime() - new Date(first.at).getTime() : null,
        needsStaff: byStudent && !staffReply && !d.locked,
        lastAt: last.at,
      }
    })

    const contributors = students.map((s) => {
      const mine = studentPosts.filter((p) => p.authorId === s.id)
      const started = discussions.filter((d) => d.authorId === s.id).length
      return { s, posts: mine.length, started, replies: mine.length - started, last: mine.reduce<string | null>((m, p) => (!m || p.at > m ? p.at : m), null) }
    }).sort((x, y) => y.posts - x.posts)

    const end = startOfDay(new Date())
    const days = eachDayOfInterval({ start: subDays(end, range - 1), end })
    const perDay = days.map((d) => {
      const k = format(d, 'yyyy-MM-dd')
      const dayPosts = posts.filter((p) => p.at.slice(0, 10) === k || format(new Date(p.at), 'yyyy-MM-dd') === k)
      return { day: format(d, 'd MMM'), students: dayPosts.filter((p) => studentIds.has(p.authorId)).length, staff: dayPosts.filter((p) => !studentIds.has(p.authorId)).length }
    })
    const weekday = WEEKDAYS.map((label, i) => ({ label, posts: posts.filter((p) => (new Date(p.at).getDay() + 6) % 7 === i).length }))

    return { posts, studentPosts, threads, contributors, perDay, weekday }
  }, [discussions, students, lecturerId, range])

  const participants = data.contributors.filter((c) => c.posts > 0)
  const silent = data.contributors.filter((c) => c.posts === 0)
  const participation = students.length ? Math.round((participants.length / students.length) * 100) : 0
  const unanswered = data.threads.filter((t) => t.replies === 0 && !t.d.locked)
  const needsStaff = data.threads.filter((t) => t.needsStaff)
  const medianFirst = median(data.threads.map((t) => t.firstReplyMs).filter((x): x is number => x !== null))
  const medianStaff = median(data.threads.map((t) => t.staffReplyMs).filter((x): x is number => x !== null && x > 0))
  const avgReplies = data.threads.length ? data.threads.reduce((n, t) => n + t.replies, 0) / data.threads.length : 0

  const openNudge = (ids: string[]) => setNudge({
    ids,
    message: `Hi! I'd love to hear your thoughts in the “${a.name}” forum. Asking questions and helping your classmates is a great way to learn — please join the discussion when you can.`,
  })
  const sendNudges = async () => {
    if (!nudge || !courseId) return
    setSending(true)
    let sent = 0
    for (const id of nudge.ids) { try { await notifyStudent(id, courseId, nudge.message); sent++ } catch (e) { toast(errorMessage(e), 'error') } }
    setSending(false); setNudge(null)
    if (sent) { toast(`Message sent to ${sent} student${sent > 1 ? 's' : ''}`); void loadBootstrap() }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={MessagesSquare} label="Discussions / posts" value={`${data.threads.length} / ${data.posts.length}`} sub={`${avgReplies.toFixed(1)} replies per discussion`} tone="#0033A0" />
        <Stat icon={Users} label="Student participation" value={news ? '-' : `${participation}%`} sub={news ? 'Announcements are lecturer-only' : `${participants.length} of ${students.length} students have posted`} tone="#16A34A" />
        <Stat icon={HelpCircle} label="Awaiting your reply" value={needsStaff.length} sub={`${unanswered.length} with no replies at all`} tone="#DC2626" />
        <Stat icon={Clock3} label="Median time to first reply" value={human(medianFirst)} sub={medianStaff === null ? 'No lecturer replies yet' : `Lecturer: ${human(medianStaff)}`} tone="#D97706" />
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-6">
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold mr-auto">Activity over time</h2>
            <div className="flex p-1 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
              {([14, 30, 90] as const).map((r) => <button key={r} onClick={() => setRange(r)} className={`h-7 px-3 rounded-lg text-xs font-semibold ${range === r ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'muted'}`}>{r} days</button>)}
            </div>
          </div>
          <p className="text-xs muted mb-2">Posts per day by students and staff</p>
          <div className="h-56">
            {data.posts.length === 0 ? <div className="h-full grid place-items-center text-sm muted">No posts yet.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.perDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--color-bg-subtle)' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="students" name="Students" stackId="a" fill="#0033A0" />
                  <Bar dataKey="staff" name="Staff" stackId="a" fill="#00B3A1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold mb-1">Busiest days</h2>
          <p className="text-xs muted mb-2">All posts by day of the week</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekday} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--color-bg-subtle)' }} contentStyle={tooltipStyle} />
                <Bar dataKey="posts" name="Posts" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-bold flex items-center gap-2"><HelpCircle size={16} style={{ color: 'var(--color-red)' }} /> Discussions needing attention ({needsStaff.length})</h2>
          <p className="text-xs muted">Started by students and not yet answered by a lecturer</p>
        </div>
        {needsStaff.length === 0 ? <div className="p-8 text-center text-sm muted">You're all caught up — every student discussion has a lecturer reply. ✅</div> : (
          <table className="w-full text-sm"><tbody>
            {needsStaff.sort((x, y) => x.d.createdAt.localeCompare(y.d.createdAt)).map((t) => (
              <tr key={t.d.id} className="border-t first:border-t-0 hover:bg-[var(--color-bg-card-hover)] cursor-pointer" style={{ borderColor: 'var(--color-border)' }} onClick={() => onOpenDiscussion(t.d.id)}>
                <td className="px-5 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{t.d.subject}</div><div className="text-xs muted">Started by {t.d.author}</div></td>
                <td className="px-3 py-3">{t.replies === 0 ? <span className="badge badge-red">No replies</span> : <span className="badge badge-amber">{t.replies} student repl{t.replies === 1 ? 'y' : 'ies'}</span>}</td>
                <td className="px-5 py-3 text-right text-xs" style={{ color: 'var(--color-red)' }}>Waiting {formatDistanceStrict(new Date(t.d.createdAt), new Date())}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </section>

      <div className="grid xl:grid-cols-2 gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b font-bold flex items-center gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}><Trophy size={16} style={{ color: 'var(--color-amber)' }} /> Top contributors</div>
          {participants.length === 0 ? <div className="p-8 text-center text-sm muted">No student posts yet.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-5 py-2.5">Student</th><th className="px-3 py-2.5">Started</th><th className="px-3 py-2.5">Replies</th><th className="px-5 py-2.5 text-right">Last post</th></tr></thead>
              <tbody>
                {participants.slice(0, 10).map((c, i) => (
                  <tr key={c.s.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-5 py-3"><span className="font-medium" style={{ color: 'var(--color-heading)' }}>{i + 1}. {c.s.name}</span></td>
                    <td className="px-3 py-3">{c.started}</td>
                    <td className="px-3 py-3">{c.replies}</td>
                    <td className="px-5 py-3 text-right text-xs muted">{c.last ? `${formatDistanceStrict(new Date(c.last), new Date())} ago` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-bold mr-auto flex items-center gap-2"><UserX size={16} style={{ color: 'var(--color-text-muted)' }} /> Not participating ({news ? 0 : silent.length})</h2>
            {!news && silent.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => openNudge(silent.map((c) => c.s.id))}><BellRing size={14} /> Encourage all</button>}
          </div>
          {news ? <div className="p-8 text-center text-sm muted">Students cannot post in Announcements.</div> : silent.length === 0 ? <div className="p-8 text-center text-sm muted">Every enrolled student has posted. 🎉</div> : (
            <table className="w-full text-sm"><tbody>
              {silent.map((c) => (
                <tr key={c.s.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-5 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{c.s.name}</div><div className="text-xs muted">{c.s.indexNo}</div></td>
                  <td className="px-5 py-3 text-right"><button className="btn btn-ghost btn-sm" onClick={() => openNudge([c.s.id])}><Send size={14} /> Encourage</button></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3 text-xs muted">
        <span className="flex items-center gap-1"><Pin size={12} /> {data.threads.filter((t) => t.d.pinned).length} pinned</span>
        <span className="flex items-center gap-1"><Lock size={12} /> {data.threads.filter((t) => t.d.locked).length} locked</span>
      </div>

      <Modal open={!!nudge} title={`Message ${nudge?.ids.length ?? 0} student${(nudge?.ids.length ?? 0) > 1 ? 's' : ''}`} onClose={() => setNudge(null)} width={580}
        footer={<><button className="btn btn-secondary" onClick={() => setNudge(null)}>Cancel</button><button className="btn btn-primary" disabled={sending || !nudge?.message.trim()} onClick={() => void sendNudges()}><Send size={15} /> {sending ? 'Sending…' : 'Send'}</button></>}>
        <p className="text-sm muted mb-3">Each student receives this in Messages and as a notification.</p>
        {nudge && <textarea rows={5} className="form-control" value={nudge.message} onChange={(e) => setNudge({ ...nudge, message: e.target.value })} />}
      </Modal>
    </div>
  )
}
