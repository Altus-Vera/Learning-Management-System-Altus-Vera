import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink } from 'react-router-dom'
import { ShieldCheck, Users, Wallet, BookPlus, ClipboardList, History, Ban, Unlock, Search, CheckCircle2, AlertTriangle, CircleDollarSign, GraduationCap, UserCheck, Save, CalendarPlus, Undo2, Download, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useIsRegistrar } from '../../store/uiStore'
import { useLmsStore, assignPhase, type Submission } from '../../store/lmsStore'
import { useAdminStore, BATCHES, LECTURERS, enrolledIds, type AuditKind, type StudentRecord } from '../../store/adminStore'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { fmtShort, fromLocalInput, toLocalInput, initials } from '../../lib/format'

const NAV = [
  { to: '/admin', label: 'Overview', icon: ShieldCheck, end: true },
  { to: '/admin/students', label: 'Batches & students', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: Wallet },
  { to: '/admin/enrolment', label: 'Course assignment', icon: BookPlus },
  { to: '/admin/submissions', label: 'Submissions control', icon: ClipboardList },
  { to: '/admin/audit', label: 'Audit log', icon: History },
]

const LKR = (n: number) => `LKR ${n.toLocaleString()}`

function Shell({ title, subtitle, actions, children }: { title: string; subtitle: string; actions?: ReactNode; children: ReactNode }) {
  const ok = useIsRegistrar()
  if (!ok) return <Navigate to="/dashboard" replace />
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-primary)' }}>Assistant Registrar</div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm muted">{subtitle}</p>
        </div>
        {actions}
      </div>
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab flex items-center gap-2 ${isActive ? 'tab-active' : ''}`}><Icon size={15} />{label}</NavLink>
        ))}
      </div>
      <div className="animate-in">{children}</div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone, to }: { icon: typeof Users; label: string; value: ReactNode; tone: string; to?: string }) {
  const body = (
    <div className="card p-5 flex items-center gap-4 h-full">
      <span className="w-12 h-12 rounded-2xl grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon size={22} /></span>
      <div><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{value}</div><div className="text-xs font-medium muted">{label}</div></div>
    </div>
  )
  return to ? <Link to={to} className="!text-inherit hover:-translate-y-0.5 transition-transform">{body}</Link> : body
}

const AUDIT_TONE: Partial<Record<AuditKind, string>> = { block: 'badge-red', unblock: 'badge-green', payment: 'badge-blue', override: 'badge-amber', grade: 'badge-blue', extension: 'badge-amber', enrol: 'badge-green', unenrol: 'badge-gray' }

function AuditList({ limit }: { limit?: number }) {
  const audit = useAdminStore((s) => s.audit)
  const list = limit ? audit.slice(0, limit) : audit
  if (!list.length) return <div className="p-10 text-center text-sm muted">No activity has been recorded yet.</div>
  return (
    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
      {list.map((e) => (
        <div key={e.id} className="flex items-start gap-3 px-5 py-3.5" style={{ borderColor: 'var(--color-border)' }}>
          <span className="w-8 h-8 rounded-full grid place-items-center text-[10px] font-bold shrink-0" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{initials(e.actor)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm"><b style={{ color: 'var(--color-heading)' }}>{e.actor}</b> <span className="muted">({e.role})</span> · <span style={{ color: 'var(--color-heading)' }}>{e.target}</span></div>
            <div className="text-sm muted">{e.detail}</div>
          </div>
          <div className="text-right shrink-0"><span className={`badge ${AUDIT_TONE[e.kind] ?? 'badge-gray'}`}>{e.kind}</span><div className="text-[11px] muted mt-1">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</div></div>
        </div>
      ))}
    </div>
  )
}

export function AdminOverview() {
  const st = useAdminStore()
  const courses = useLmsStore((s) => s.courses)
  const subs = useLmsStore((s) => s.submissions)
  const unpaid = Object.values(st.payments).filter((p) => !p.paid)
  const toGrade = Object.values(subs).filter((s) => s.status === 'submitted' && s.grade === null).length
  const blocked = new Set([...Object.keys(st.accountBlocks), ...Object.keys(st.courseBlocks).map((k) => k.split(':')[1])]).size
  return (
    <Shell title="Registrar overview" subtitle="Manage batches, payments, course assignments and all student submissions.">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat icon={Users} label="Students" value={st.students.length} tone="#0033A0" to="/admin/students" />
        <Stat icon={CircleDollarSign} label={`Unpaid fees · ${LKR(unpaid.reduce((n, p) => n + p.amount, 0))}`} value={unpaid.length} tone="#D97706" to="/admin/payments" />
        <Stat icon={Ban} label="Blocked students" value={blocked} tone="#DC2626" to="/admin/students" />
        <Stat icon={ClipboardList} label="Submissions awaiting grading" value={toGrade} tone="#0D9488" to="/admin/submissions" />
      </div>
      <div className="grid xl:grid-cols-[1fr_420px] gap-6">
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}>Batches</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Year / Semester</th><th className="px-5 py-3">Students</th><th className="px-5 py-3">Unpaid</th></tr></thead>
            <tbody>{BATCHES.map((b) => {
              const ids = st.students.filter((s) => s.batchId === b.id).map((s) => s.id)
              return <tr key={b.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="px-5 py-3 font-medium" style={{ color: 'var(--color-heading)' }}>{b.name}</td><td className="px-5 py-3 muted">Year {b.year} · Semester {b.semester}</td><td className="px-5 py-3">{ids.length}</td><td className="px-5 py-3">{Object.entries(st.payments).filter(([k, p]) => !p.paid && ids.includes(k.split(':')[1])).length}</td></tr>
            })}</tbody>
          </table>
          <div className="px-5 py-4 border-t font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}>Courses</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-5 py-3">Course</th><th className="px-5 py-3">Lecturer</th><th className="px-5 py-3">Enrolled</th></tr></thead>
            <tbody>{courses.map((c) => <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="px-5 py-3"><Link to={`/courses/${c.id}`} className="font-medium" style={{ color: 'var(--color-heading)' }}>{c.shortName}-{c.fullName}</Link></td><td className="px-5 py-3 muted">{st.courseLecturers[c.id] ?? c.lecturer}</td><td className="px-5 py-3">{enrolledIds(st.enrolments, c.id).length}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="card overflow-hidden h-fit">
          <div className="px-5 py-4 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}><span className="font-bold mr-auto" style={{ color: 'var(--color-heading)' }}>Recent activity</span><Link to="/admin/audit" className="text-sm font-semibold">View all</Link></div>
          <AuditList limit={8} />
        </section>
      </div>
    </Shell>
  )
}

function BlockDialog({ open, title, onClose, onConfirm, courses }: { open: boolean; title: string; onClose: () => void; onConfirm: (scope: 'account' | number, reason: string) => void; courses: { id: number; label: string }[] }) {
  const [scope, setScope] = useState<'account' | number>('account')
  const [reason, setReason] = useState('Outstanding payment for coursework')
  return (
    <Modal open={open} title={title} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-danger" disabled={!reason.trim()} onClick={() => { onConfirm(scope, reason.trim()); onClose() }}><Ban size={15} /> Block</button></>}>
      <div className="space-y-4">
        <div><label className="form-label">Block from</label>
          <select className="form-control" value={String(scope)} onChange={(e) => setScope(e.target.value === 'account' ? 'account' : Number(e.target.value))}>
            <option value="account">Entire account (all courses and submissions)</option>
            {courses.map((c) => <option key={c.id} value={c.id}>Only {c.label}</option>)}
          </select>
        </div>
        <div><label className="form-label">Reason (shown to the student)</label>
          <select className="form-control mb-2" value={['Outstanding payment for coursework', 'Disciplinary action', 'Incomplete registration', 'Academic misconduct'].includes(reason) ? reason : 'other'} onChange={(e) => e.target.value !== 'other' && setReason(e.target.value)}>
            {['Outstanding payment for coursework', 'Disciplinary action', 'Incomplete registration', 'Academic misconduct'].map((r) => <option key={r}>{r}</option>)}<option value="other">Other…</option>
          </select>
          <textarea rows={2} className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

export function AdminStudents() {
  const st = useAdminStore()
  const courses = useLmsStore((s) => s.courses)
  const [batch, setBatch] = useState<string>('all')
  const [status, setStatus] = useState<'all' | 'blocked' | 'unpaid' | 'active'>('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [blockFor, setBlockFor] = useState<string[] | null>(null)
  const [detail, setDetail] = useState<StudentRecord | null>(null)

  const unpaidOf = (id: string) => Object.entries(st.payments).filter(([k, p]) => !p.paid && k.endsWith(`:${id}`))
  const courseBlocksOf = (id: string) => Object.entries(st.courseBlocks).filter(([k]) => k.endsWith(`:${id}`))
  const rows = st.students.filter((s) => (batch === 'all' || s.batchId === batch)
    && `${s.name} ${s.email} ${s.indexNo}`.toLowerCase().includes(q.toLowerCase())
    && (status === 'all' || (status === 'blocked' ? !!st.accountBlocks[s.id] || courseBlocksOf(s.id).length > 0 : status === 'unpaid' ? unpaidOf(s.id).length > 0 : !st.accountBlocks[s.id] && !courseBlocksOf(s.id).length)))
  const allSel = rows.length > 0 && rows.every((r) => sel.includes(r.id))
  const courseOpts = courses.map((c) => ({ id: c.id, label: `${c.shortName}-${c.fullName}` }))

  return (
    <Shell title="Batches & students" subtitle="Block or unblock students for unpaid fees or other reasons. Blocked students cannot access courses or submit work."
      actions={<button className="btn btn-danger btn-sm" onClick={() => { void st.blockAllUnpaid().then((n) => toast(n ? `${n} course access(es) blocked for unpaid fees` : 'No unpaid students to block', n ? 'success' : 'info')) }}><Ban size={15} /> Block all unpaid</button>}>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9 !h-9 !w-64" placeholder="Search name, email or index number" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="form-control !w-auto !h-9" value={batch} onChange={(e) => setBatch(e.target.value)}><option value="all">All batches</option>{BATCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="form-control !w-auto !h-9" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">All statuses</option><option value="active">Active</option><option value="unpaid">Has unpaid fees</option><option value="blocked">Blocked</option></select>
          {sel.length > 0 && <div className="ml-auto flex items-center gap-2"><span className="text-sm muted">{sel.length} selected</span>
            <button className="btn btn-danger btn-sm" onClick={() => setBlockFor(sel)}><Ban size={14} /> Block</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { st.unblockAll(sel); setSel([]); toast('Selected students unblocked') }}><Unlock size={14} /> Unblock</button>
          </div>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
              <th className="px-4 py-3 w-10"><input type="checkbox" className="w-4 h-4" checked={allSel} onChange={() => setSel(allSel ? [] : rows.map((r) => r.id))} aria-label="Select all" /></th>
              <th className="px-4 py-3">Student</th><th className="px-4 py-3">Index no.</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Payments</th><th className="px-4 py-3">Access</th><th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {rows.map((s) => {
                const unpaid = unpaidOf(s.id); const cb = courseBlocksOf(s.id); const ab = st.accountBlocks[s.id]
                return (
                  <tr key={s.id} className="border-t hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3"><input type="checkbox" className="w-4 h-4" checked={sel.includes(s.id)} onChange={() => setSel(sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id])} aria-label={`Select ${s.name}`} /></td>
                    <td className="px-4 py-3"><button onClick={() => setDetail(s)} className="font-medium text-left hover:underline" style={{ color: 'var(--color-heading)' }}>{s.name}</button><div className="text-xs muted">{s.email}</div></td>
                    <td className="px-4 py-3 muted whitespace-nowrap">{s.indexNo}</td>
                    <td className="px-4 py-3 muted">{BATCHES.find((b) => b.id === s.batchId)?.programme} {BATCHES.find((b) => b.id === s.batchId)?.intake}</td>
                    <td className="px-4 py-3">{unpaid.length ? <span className="badge badge-amber">{unpaid.length} unpaid · {LKR(unpaid.reduce((n, [, p]) => n + p.amount, 0))}</span> : <span className="badge badge-green">All paid</span>}</td>
                    <td className="px-4 py-3">{ab ? <span className="badge badge-red" title={ab.reason}><Ban size={12} /> Account blocked</span> : cb.length ? <span className="badge badge-red" title={cb.map(([, b]) => b.reason).join('\n')}><Ban size={12} /> {cb.length} course(s) blocked</span> : <span className="badge badge-green"><CheckCircle2 size={12} /> Active</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {ab || cb.length
                        ? <button className="btn btn-secondary btn-sm" onClick={() => { st.unblockAll([s.id]); toast(`${s.name} unblocked`) }}><Unlock size={14} /> Unblock</button>
                        : <button className="btn btn-secondary btn-sm" onClick={() => setBlockFor([s.id])}><Ban size={14} /> Block</button>}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center muted">No students match the filters</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <BlockDialog open={!!blockFor} title={`Block ${blockFor?.length ?? 0} student(s)`} courses={courseOpts} onClose={() => setBlockFor(null)}
        onConfirm={(scope, reason) => { if (scope === 'account') st.blockAccount(blockFor!, reason); else st.blockCourse(scope, blockFor!, reason); setSel([]); toast('Student access blocked') }} />
      <Modal open={!!detail} title={detail?.name ?? ''} onClose={() => setDetail(null)} width={640}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3"><div><span className="muted">Index no.</span><div style={{ color: 'var(--color-heading)' }}>{detail.indexNo}</div></div><div><span className="muted">Email</span><div style={{ color: 'var(--color-heading)' }}>{detail.email}</div></div><div><span className="muted">Phone</span><div style={{ color: 'var(--color-heading)' }}>{detail.phone}</div></div><div><span className="muted">Batch</span><div style={{ color: 'var(--color-heading)' }}>{BATCHES.find((b) => b.id === detail.batchId)?.name}</div></div></div>
            <div><div className="font-semibold mb-2" style={{ color: 'var(--color-heading)' }}>Courses</div>
              {courses.filter((c) => enrolledIds(st.enrolments, c.id).includes(detail.id)).map((c) => {
                const p = st.payments[`${c.id}:${detail.id}`]; const b = st.courseBlocks[`${c.id}:${detail.id}`]
                return <div key={c.id} className="flex items-center gap-2 py-2 border-t" style={{ borderColor: 'var(--color-border)' }}><span className="flex-1">{c.shortName}-{c.fullName}</span>{p && <span className={`badge ${p.paid ? 'badge-green' : 'badge-amber'}`}>{p.paid ? 'Paid' : 'Unpaid'}</span>}{b && <span className="badge badge-red" title={b.reason}>Blocked</span>}</div>
              })}
            </div>
            {st.accountBlocks[detail.id] && <div className="p-3 rounded-xl" style={{ background: 'var(--color-red-soft)', color: 'var(--color-red)' }}>Account blocked by {st.accountBlocks[detail.id].by} on {fmtShort(st.accountBlocks[detail.id].at)}: {st.accountBlocks[detail.id].reason}</div>}
          </div>
        )}
      </Modal>
    </Shell>
  )
}

export function AdminPayments() {
  const st = useAdminStore()
  const courses = useLmsStore((s) => s.courses)
  const [course, setCourse] = useState<number>(0)
  const [status, setStatus] = useState<'all' | 'paid' | 'unpaid'>('unpaid')
  const [q, setQ] = useState('')
  const rows = Object.entries(st.payments).map(([k, p]) => { const [cid, sid] = k.split(':'); return { cid: Number(cid), sid, p, s: st.students.find((x) => x.id === sid), c: courses.find((x) => x.id === Number(cid)) } })
    .filter((r) => r.s && r.c && enrolledIds(st.enrolments, r.cid).includes(r.sid) && (!course || r.cid === course) && (status === 'all' || (status === 'paid') === r.p.paid) && `${r.s.name} ${r.s.indexNo}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(a.p.paid) - Number(b.p.paid) || a.p.dueDate.localeCompare(b.p.dueDate))
  const totals = Object.values(st.payments)
  return (
    <Shell title="Payments" subtitle="Track coursework fee payments. Marking a fee as paid automatically lifts a payment block for that course."
      actions={<label className="flex items-center gap-3 card px-4 py-2.5 cursor-pointer"><span className="text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>Auto-block unpaid students</span><button className="switch" data-on={st.autoBlockUnpaid} onClick={() => st.setAutoBlock(!st.autoBlockUnpaid)} aria-label="Auto-block unpaid students" /></label>}>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat icon={CircleDollarSign} label="Collected" value={LKR(totals.filter((p) => p.paid).reduce((n, p) => n + p.amount, 0))} tone="#16A34A" />
        <Stat icon={AlertTriangle} label="Outstanding" value={LKR(totals.filter((p) => !p.paid).reduce((n, p) => n + p.amount, 0))} tone="#D97706" />
        <Stat icon={Ban} label="Blocked for non-payment" value={Object.values(st.courseBlocks).filter((b) => b.reason.startsWith('Outstanding payment')).length} tone="#DC2626" />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9 !h-9 !w-56" placeholder="Search student" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="form-control !w-auto !h-9" value={course} onChange={(e) => setCourse(Number(e.target.value))}><option value={0}>All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.shortName}-{c.fullName}</option>)}</select>
          <select className="form-control !w-auto !h-9" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">All</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select>
          <button className="btn btn-secondary btn-sm ml-auto" onClick={() => toast('Exporting payment report…', 'info')}><Download size={14} /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-4 py-3">Student</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Access</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows.map(({ cid, sid, p, s, c }) => {
                const b = st.courseBlocks[`${cid}:${sid}`] || st.accountBlocks[sid]
                const overdue = !p.paid && new Date(p.dueDate) < new Date()
                return (
                  <tr key={`${cid}:${sid}`} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{s!.name}</div><div className="text-xs muted">{s!.indexNo}</div></td>
                    <td className="px-4 py-3 muted">{c!.shortName}</td>
                    <td className="px-4 py-3">{LKR(p.amount)}</td>
                    <td className="px-4 py-3 muted whitespace-nowrap">{fmtShort(p.dueDate).split(',')[0]}</td>
                    <td className="px-4 py-3">{p.paid ? <span className="badge badge-green">Paid · {p.reference}</span> : <span className={`badge ${overdue ? 'badge-red' : 'badge-amber'}`}>{overdue ? 'Overdue' : 'Pending'}</span>}</td>
                    <td className="px-4 py-3">{b ? <span className="badge badge-red" title={b.reason}>Blocked</span> : <span className="badge badge-green">Active</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <button className={`btn btn-sm ${p.paid ? 'btn-secondary' : 'btn-green'}`} onClick={() => { st.setPaid(cid, sid, !p.paid); toast(p.paid ? 'Marked as unpaid' : 'Payment recorded') }}>{p.paid ? 'Mark unpaid' : 'Mark paid'}</button>
                      {!p.paid && !st.courseBlocks[`${cid}:${sid}`] && <button className="btn btn-danger btn-sm" onClick={() => { st.blockCourse(cid, [sid], 'Outstanding payment for coursework'); toast(`${s!.name} blocked from ${c!.shortName}`) }}><Ban size={13} /> Block</button>}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center muted">No payment records match the filters</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  )
}

export function AdminEnrolment() {
  const st = useAdminStore()
  const courses = useLmsStore((s) => s.courses)
  const [courseId, setCourseId] = useState<number>(courses[0]?.id ?? 0)
  const [batch, setBatch] = useState(BATCHES[0].id)
  const course = courses.find((c) => c.id === courseId)
  const enrolled = enrolledIds(st.enrolments, courseId)
  const batchStudents = st.students.filter((s) => s.batchId === batch)
  const [sel, setSel] = useState<string[]>([])
  const [lecturer, setLecturer] = useState('')
  useEffect(() => { setSel(batchStudents.filter((s) => !enrolled.includes(s.id)).map((s) => s.id)); setLecturer(course?.lecturerId ?? LECTURERS.find((l) => l.name === (st.courseLecturers[courseId] ?? course?.lecturer))?.id ?? '') }, [courseId, batch]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell title="Course assignment" subtitle="Assign courses and coursework to a batch by selecting the students to enrol, and set the course lecturer.">
      <div className="grid xl:grid-cols-[360px_1fr] gap-6">
        <section className="card p-5 space-y-4 h-fit">
          <div><label className="form-label">Course</label><select className="form-control" value={courseId} onChange={(e) => setCourseId(Number(e.target.value))}>{courses.map((c) => <option key={c.id} value={c.id}>{c.shortName}-{c.fullName}</option>)}</select></div>
          <div><label className="form-label">Lecturer in charge</label>
            <div className="flex gap-2"><select className="form-control" value={lecturer} onChange={(e) => setLecturer(e.target.value)}>{LECTURERS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <button className="btn btn-primary !px-3" disabled={!lecturer || lecturer === course?.lecturerId} onClick={() => { st.setLecturer(courseId, lecturer); toast('Lecturer assigned') }} aria-label="Save lecturer"><UserCheck size={16} /></button></div>
          </div>
          <div><label className="form-label">Batch</label><select className="form-control" value={batch} onChange={(e) => setBatch(e.target.value)}>{BATCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="p-4 rounded-xl text-sm space-y-1" style={{ background: 'var(--color-bg-subtle)' }}>
            <div><span className="muted">Currently enrolled in course:</span> <b style={{ color: 'var(--color-heading)' }}>{enrolled.length}</b></div>
            <div><span className="muted">From this batch:</span> <b style={{ color: 'var(--color-heading)' }}>{batchStudents.filter((s) => enrolled.includes(s.id)).length} / {batchStudents.length}</b></div>
          </div>
          <button className="btn btn-primary w-full" disabled={!sel.filter((id) => !enrolled.includes(id)).length} onClick={() => { const ids = sel.filter((id) => !enrolled.includes(id)); st.enrol(courseId, ids); toast(`${ids.length} student(s) enrolled in ${course?.shortName}`) }}><BookPlus size={16} /> Assign course to {sel.filter((id) => !enrolled.includes(id)).length} selected student(s)</button>
        </section>
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-bold mr-auto">{BATCHES.find((b) => b.id === batch)?.name}</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setSel(batchStudents.map((s) => s.id))}>Select all</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSel([])}>Clear</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-4 py-3 w-10" /><th className="px-4 py-3">Student</th><th className="px-4 py-3">Index no.</th><th className="px-4 py-3">Status in course</th><th className="px-4 py-3" /></tr></thead>
            <tbody>{batchStudents.map((s) => {
              const isIn = enrolled.includes(s.id)
              return (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3"><input type="checkbox" className="w-4 h-4" disabled={isIn} checked={isIn || sel.includes(s.id)} onChange={() => setSel(sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id])} aria-label={`Select ${s.name}`} /></td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-heading)' }}>{s.name}</td>
                  <td className="px-4 py-3 muted">{s.indexNo}</td>
                  <td className="px-4 py-3">{isIn ? <span className="badge badge-green">Enrolled</span> : <span className="badge badge-gray">Not enrolled</span>}</td>
                  <td className="px-4 py-3 text-right">{isIn && <button className="btn btn-secondary btn-sm" onClick={() => { st.unenrol(courseId, [s.id]); toast(`${s.name} removed from ${course?.shortName}`) }}>Unenrol</button>}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </section>
      </div>
    </Shell>
  )
}

export function AdminSubmissions() {
  const st = useAdminStore()
  const courses = useLmsStore((s) => s.courses)
  const subs = useLmsStore((s) => s.submissions)
  const [courseId, setCourseId] = useState<number>(courses[0]?.id ?? 0)
  const course = courses.find((c) => c.id === courseId)
  const assigns = useMemo(() => course?.sections.flatMap((s) => s.activities.filter((a) => a.type === 'assign')) ?? [], [course])
  const [activityId, setActivityId] = useState<number>(0)
  const [filter, setFilter] = useState<'all' | 'submitted' | 'missing' | 'graded' | 'overridden'>('all')
  const [edit, setEdit] = useState<{ sid: string; sub: Submission } | null>(null)
  useEffect(() => { setActivityId(assigns[0]?.id ?? 0) }, [courseId]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = assigns.find((x) => x.id === activityId)
  const students = st.students.filter((s) => enrolledIds(st.enrolments, courseId).includes(s.id))
  const rows = students.map((s) => ({ s, sub: subs[`${activityId}:${s.id}`] ?? { studentId: s.id, status: 'new' as const, files: [], onlineText: '', modifiedAt: null, grade: null, feedback: '', gradedAt: null } }))
    .filter(({ s, sub }) => filter === 'all' || (filter === 'submitted' ? sub.status === 'submitted' : filter === 'missing' ? sub.status !== 'submitted' : filter === 'graded' ? sub.grade !== null : !!st.overrides[`${activityId}:${s.id}`]))

  return (
    <Shell title="Submissions control" subtitle="View every submission. Override grades and statuses set by lecturers, revert submissions and grant extensions. All changes are logged.">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <select className="form-control !w-auto !h-9" value={courseId} onChange={(e) => setCourseId(Number(e.target.value))}>{courses.map((c) => <option key={c.id} value={c.id}>{c.shortName}-{c.fullName}</option>)}</select>
          <select className="form-control !w-auto !h-9" value={activityId} onChange={(e) => setActivityId(Number(e.target.value))}>{assigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <div className="flex items-center gap-1.5"><Filter size={14} className="muted" /><select className="form-control !w-auto !h-9" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">All</option><option value="submitted">Submitted</option><option value="missing">Not submitted</option><option value="graded">Graded</option><option value="overridden">Overridden by registrar</option></select></div>
          {a && <Link to={`/courses/${courseId}/assign/${a.id}?tab=settings`} className="btn btn-secondary btn-sm ml-auto !text-[var(--color-heading)]">Assignment settings</Link>}
        </div>
        {a && <div className="px-4 py-2.5 text-xs muted border-b" style={{ borderColor: 'var(--color-border)' }}>Due {fmtShort(a.assign?.dueDate ?? null)} · Cut-off {fmtShort(a.assign?.cutOffDate ?? null)} · {assignPhase(a.assign!) === 'disabled' ? 'Submissions disabled' : 'Accepting submissions within dates'}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-4 py-3">Student</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Extension</th><th className="px-4 py-3">Last modified</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows.map(({ s, sub }) => {
                const key = `${activityId}:${s.id}`; const ov = st.overrides[key]; const ext = st.extensions[key]
                return (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{s.name}</div><div className="text-xs muted">{s.indexNo}</div></td>
                    <td className="px-4 py-3"><span className={`badge ${sub.status === 'submitted' ? 'badge-green' : sub.status === 'draft' ? 'badge-amber' : 'badge-gray'}`}>{sub.status === 'submitted' ? 'Submitted' : sub.status === 'draft' ? 'Draft' : 'No submission'}</span>{(st.accountBlocks[s.id] || st.courseBlocks[`${courseId}:${s.id}`]) && <span className="badge badge-red ml-1">Blocked</span>}</td>
                    <td className="px-4 py-3">{sub.grade === null ? <span className="muted">-</span> : <b style={{ color: 'var(--color-heading)' }}>{sub.grade}</b>}{ov && <span className="badge badge-amber ml-2" title={`Previously: ${ov.previous}`}>Overridden</span>}</td>
                    <td className="px-4 py-3 muted">{ext ? fmtShort(ext) : '-'}</td>
                    <td className="px-4 py-3 muted whitespace-nowrap">{fmtShort(sub.modifiedAt)}</td>
                    <td className="px-4 py-3 text-right"><button className="btn btn-secondary btn-sm" onClick={() => setEdit({ sid: s.id, sub })}>Manage</button></td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center muted">Nothing to display</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {edit && a && <OverrideDialog key={edit.sid} activityId={a.id} maxGrade={a.assign!.maxGrade} dueDate={a.assign!.dueDate} sid={edit.sid} sub={edit.sub} onClose={() => setEdit(null)}
        onSave={(g, f, status, ext) => {
          void st.overrideSubmission(a.id, edit.sid, { grade: g, feedback: f, status, extensionUntil: ext }).then((ok) => { if (ok) { setEdit(null); toast('Changes saved and logged') } })
        }} />}
    </Shell>
  )
}

function OverrideDialog({ maxGrade, dueDate, sid, sub, onClose, onSave, activityId }: { activityId: number; maxGrade: number; dueDate: string | null; sid: string; sub: Submission; onClose: () => void; onSave: (g: number | null, f: string, status: Submission['status'], ext: string | null) => void }) {
  const ext0 = useAdminStore((s) => s.extensions[`${activityId}:${sid}`] ?? null)
  const name = useAdminStore((s) => s.students.find((x) => x.id === sid)?.name)
  const [g, setG] = useState(sub.grade?.toString() ?? '')
  const [f, setF] = useState(sub.feedback)
  const [status, setStatus] = useState(sub.status)
  const [ext, setExt] = useState<string | null>(ext0)
  const commit = () => {
    const n = g.trim() === '' ? null : Number(g)
    if (n !== null && (isNaN(n) || n < 0 || n > maxGrade)) return toast(`Grade must be between 0 and ${maxGrade}`, 'error')
    if (ext && dueDate && ext <= dueDate) return toast('Extension date must be after the due date', 'error')
    onSave(n, f, status, ext)
  }
  return (
    <Modal open title={`Manage submission · ${name}`} onClose={onClose} width={600}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={commit}><Save size={15} /> Save and log</button></>}>
      <div className="space-y-4">
        <div className="p-3 rounded-xl text-sm flex gap-2" style={{ background: 'var(--color-amber-soft)', color: 'var(--color-amber)' }}><AlertTriangle size={16} className="shrink-0 mt-0.5" />Changes here override the lecturer and are recorded in the audit log.</div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="form-label">Grade (out of {maxGrade})</label><input className="form-control" inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} placeholder="Not graded" /></div>
          <div><label className="form-label">Submission status</label><select className="form-control" value={status} onChange={(e) => setStatus(e.target.value as Submission['status'])}><option value="new">No submission</option><option value="draft">Draft (reopened)</option><option value="submitted">Submitted for grading</option></select></div>
        </div>
        <div><label className="form-label">Feedback comments</label><textarea rows={3} className="form-control" value={f} onChange={(e) => setF(e.target.value)} /></div>
        <div><label className="form-label flex items-center gap-2"><CalendarPlus size={15} /> Extension (individual due date)</label>
          <div className="flex gap-2"><input type="datetime-local" className="form-control" value={toLocalInput(ext)} onChange={(e) => setExt(fromLocalInput(e.target.value))} />{ext && <button className="btn btn-secondary" onClick={() => setExt(null)}><Undo2 size={15} /> Remove</button>}</div>
          <p className="text-xs muted mt-1">The student can submit until this date even after the cut-off.</p>
        </div>
      </div>
    </Modal>
  )
}

export function AdminAudit() {
  const audit = useAdminStore((s) => s.audit)
  return (
    <Shell title="Audit log" subtitle="Every change made by lecturers and the Assistant Registrar."
      actions={<button className="btn btn-secondary btn-sm" onClick={() => toast(`Exporting ${audit.length} entries…`, 'info')}><Download size={14} /> Export</button>}>
      <section className="card overflow-hidden"><AuditList /></section>
    </Shell>
  )
}

export function RegistrarBadge() {
  return <span className="badge badge-blue"><GraduationCap size={12} /> Assistant Registrar</span>
}
