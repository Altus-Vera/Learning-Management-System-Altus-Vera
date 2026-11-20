import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarClock, CalendarCheck, CalendarX, UploadCloud, FileText, X, Lock, Unlock, Download, Save, Send, Pencil, Trash2, Eye, EyeOff, Users, ClipboardCheck, Clock, AlertTriangle, Info } from 'lucide-react'
import { useLmsStore, findActivity, assignPhase, CURRENT_STUDENT_ID, type Student, type Activity, type AssignSettings, type Submission, type SubmissionFile } from '../../../store/lmsStore'
import { useRole } from '../../../store/uiStore'
import { ActivityIcon } from '../../../components/ActivityIcon'
import { Modal, Confirm } from '../../../components/Modal'
import { toast } from '../../../components/Toast'
import { fmtDate, fmtShort, fmtSize, fromLocalInput, timeLeft, toLocalInput, initials } from '../../../lib/format'
import { formatDistanceStrict } from 'date-fns'
import { ActivityNav } from '../../../components/ActivityNav'
import { call } from '../../../services/sync'
import { uploadFile, deleteFile, saveSubmission, submitForGrading, removeSubmission, downloadFile } from '../assignApi'
import { useActivityStore, useMe, type Comment } from '../../../store/activityStore'
import { useAdminStore, useEnrolled, useCourseIdOfActivity, useExtension, useBlockState, logAudit, nameOf } from '../../../store/adminStore'

const EMPTY: Submission = { studentId: CURRENT_STUDENT_ID, status: 'new', files: [], onlineText: '', modifiedAt: null, grade: null, feedback: '', gradedAt: null }

function Row({ label, children, tone }: { label: string; children: ReactNode; tone?: 'green' | 'red' | 'amber' }) {
  const bg = tone ? `var(--color-${tone}-soft)` : undefined
  return (
    <div className="grid sm:grid-cols-[220px_1fr] border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
      <div className="px-5 py-3.5 text-sm font-semibold" style={{ color: 'var(--color-heading)', background: 'var(--color-bg-subtle)' }}>{label}</div>
      <div className="px-5 py-3.5 text-sm" style={{ background: bg, color: tone ? `var(--color-${tone})` : 'var(--color-text)', fontWeight: tone ? 600 : 400 }}>{children}</div>
    </div>
  )
}

function FileChip({ f, onRemove }: { f: SubmissionFile; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-2.5 pr-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
      <span className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: 'var(--color-red-soft)', color: 'var(--color-red)' }}><FileText size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--color-heading)' }}>{f.name}</div>
        <div className="text-xs muted">{fmtSize(f.size)} · {fmtShort(f.uploadedAt)}</div>
      </div>
      {onRemove ? <button className="icon-btn !w-8 !h-8" onClick={onRemove} aria-label={`Remove ${f.name}`}><X size={16} /></button> : <button className="icon-btn !w-8 !h-8" onClick={() => void downloadFile(f)} aria-label={`Download ${f.name}`}><Download size={16} /></button>}
    </div>
  )
}

function DatesHeader({ s }: { s: AssignSettings }) {
  const now = new Date()
  const opened = s.allowSubmissionsFrom && new Date(s.allowSubmissionsFrom) <= now
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {[
        { icon: CalendarCheck, label: opened ? 'Opened' : 'Opens', value: s.allowSubmissionsFrom, tone: 'var(--color-green)' },
        { icon: CalendarClock, label: 'Due', value: s.dueDate, tone: 'var(--color-primary)' },
        { icon: CalendarX, label: 'Cut-off', value: s.cutOffDate, tone: 'var(--color-red)' },
      ].map(({ icon: Icon, label, value, tone }) => (
        <div key={label} className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background: 'var(--color-bg-subtle)' }}>
          <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon size={19} /></span>
          <div className="min-w-0"><div className="text-xs font-semibold muted">{label}</div><div className="text-sm font-semibold truncate" style={{ color: 'var(--color-heading)' }}>{value ? fmtShort(value) : 'Not set'}</div></div>
        </div>
      ))}
    </div>
  )
}

function SubmissionEditor({ a, sub, onDone }: { a: Activity; sub: Submission; onDone: () => void }) {
  const s = a.assign!
  const live = useLmsStore((st) => st.submissions[`${a.id}:${CURRENT_STUDENT_ID}`])
  const files: SubmissionFile[] = live?.files ?? sub.files
  const [text, setText] = useState(sub.onlineText)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const accepted = s.acceptedTypes.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    setError('')
    let count = files.length
    const valid: File[] = []
    for (const f of Array.from(list)) {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
      if (accepted.length && !accepted.includes(ext)) { setError(`${f.name}: File type ${ext} is not accepted. Accepted file types: ${s.acceptedTypes}`); continue }
      if (f.size > s.maxSizeMb * 1_048_576) { setError(`${f.name} is too large. The maximum size is ${s.maxSizeMb} MB.`); continue }
      if (count >= s.maxFiles) { setError(`You can attach a maximum of ${s.maxFiles} file(s) to this submission.`); break }
      valid.push(f); count++
    }
    if (!valid.length) return
    setBusy(true)
    for (const f of valid) await call(() => uploadFile(a.id, f))
    setBusy(false)
  }

  const submit = async () => {
    if (s.fileSubmissions && !s.onlineText && files.length === 0) return setError('Nothing was submitted. You must add at least one file.')
    if (s.onlineText && !s.fileSubmissions && !text.trim()) return setError('Online text is required.')
    setBusy(true)
    const ok = await saveSubmission(a.id, text)
    setBusy(false)
    if (ok === undefined) return
    toast(s.requireSubmitButton ? 'Changes saved. Remember to click “Submit assignment”.' : 'Submission saved')
    onDone()
  }

  return (
    <div className="card p-6 space-y-5 animate-in">
      <div><h2 className="text-lg font-bold">{sub.status === 'new' ? 'Add submission' : 'Edit submission'}</h2><p className="text-sm muted">Upload your work below, then save your changes.</p></div>

      {s.onlineText && (
        <div><label className="form-label">Online text</label><textarea rows={8} className="form-control" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer here…" /><div className="text-xs muted mt-1">{text.trim().split(/\s+/).filter(Boolean).length} words</div></div>
      )}

      {s.fileSubmissions && (
        <div>
          <div className="flex items-baseline justify-between mb-1.5"><label className="form-label !mb-0">File submissions</label><span className="text-xs muted">Maximum file size: {s.maxSizeMb} MB, maximum number of files: {s.maxFiles}</span></div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files) }}
            onClick={() => input.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${drag ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-bg-subtle)]'}`}
            style={{ borderColor: drag ? undefined : 'var(--color-border-strong)' }}>
            <UploadCloud size={36} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
            <div className="mt-2 font-semibold" style={{ color: 'var(--color-heading)' }}>Drag and drop files here, or click to browse</div>
            <div className="text-xs muted mt-1">Accepted file types: {s.acceptedTypes || 'All file types'}</div>
            <input ref={input} type="file" hidden multiple={s.maxFiles > 1} accept={s.acceptedTypes} onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
          </div>
          {files.length > 0 && <div className="grid sm:grid-cols-2 gap-2 mt-3">{files.map((f, i) => <FileChip key={(f.id ?? f.name) + String(i)} f={f} onRemove={() => { if (f.id) void deleteFile(f.id) }} />)}</div>}
        </div>
      )}

      {error && <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'var(--color-red-soft)', color: 'var(--color-red)' }}><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}

      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy} onClick={() => void submit()}><Save size={16} /> {busy ? 'Saving…' : 'Save changes'}</button><button className="btn btn-secondary" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

function StudentView({ a }: { a: Activity }) {
  const s = a.assign!
  const sub = useLmsStore((st) => st.submissions[`${a.id}:${CURRENT_STUDENT_ID}`]) ?? EMPTY
  const [editing, setEditing] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [statement, setStatement] = useState(false)
  const ext = useExtension(a.id)
  const block = useBlockState(useCourseIdOfActivity(a.id))
  const basePhase = assignPhase(s)
  const phase = ext && s.acceptingSubmissions && new Date() <= new Date(ext) ? ('open' as const) : basePhase
  const graded = sub.grade !== null
  const accepting = phase === 'open' || phase === 'overdue'
  const canEdit = !block.blocked && accepting && (sub.status !== 'submitted' || (!s.requireSubmitButton && !graded))

  if (editing) return <SubmissionEditor a={a} sub={sub} onDone={() => setEditing(false)} />

  const statusText = sub.status === 'submitted' ? 'Submitted for grading' : sub.status === 'draft' ? 'Draft (not submitted)' : 'No attempt'
  const due = s.dueDate ? new Date(s.dueDate) : null
  let remaining: ReactNode = timeLeft(s.dueDate)
  let remainingTone: 'green' | 'red' | undefined
  if (sub.status === 'submitted' && due && sub.modifiedAt) {
    const m = new Date(sub.modifiedAt)
    remaining = m <= due ? `Assignment was submitted ${formatDistanceStrict(due, m)} early` : `Assignment was submitted ${formatDistanceStrict(m, due)} late`
    remainingTone = m <= due ? 'green' : 'red'
  } else if (due && due < new Date()) remainingTone = 'red'

  return (
    <div className="space-y-6">
      {block.blocked && <Notice tone="red" icon={Lock}>Your access to submissions has been restricted by the Assistant Registrar: {block.reason}. Please contact the registrar's office to resolve this.</Notice>}
      {ext && <Notice tone="green" icon={CalendarCheck}>You have been granted an extension until {fmtDate(ext)}.</Notice>}
      {phase === 'not-open' && <Notice tone="amber" icon={Lock}>This assignment will accept submissions from {fmtDate(s.allowSubmissionsFrom)}.</Notice>}
      {phase === 'closed' && sub.status !== 'submitted' && <Notice tone="red" icon={Lock}>This assignment is not accepting submissions. The cut-off date was {fmtDate(s.cutOffDate)}.</Notice>}
      {phase === 'disabled' && sub.status !== 'submitted' && <Notice tone="red" icon={Lock}>Submissions for this assignment have been disabled by the lecturer.</Notice>}
      {phase === 'overdue' && canEdit && <Notice tone="amber" icon={AlertTriangle}>The due date has passed. Late submissions are accepted until {fmtDate(s.cutOffDate)}.</Notice>}

      <div className="flex flex-wrap gap-2">
        {canEdit && sub.status === 'new' && <button className="btn btn-primary" onClick={() => setEditing(true)}><UploadCloud size={17} /> Add submission</button>}
        {canEdit && sub.status === 'draft' && <>
          <button className="btn btn-primary" onClick={() => setEditing(true)}><Pencil size={16} /> Edit submission</button>
          <button className="btn btn-secondary" onClick={() => setConfirmRemove(true)}><Trash2 size={16} /> Remove submission</button>
          <button className="btn btn-green" onClick={() => { setStatement(false); setConfirmSubmit(true) }}><Send size={16} /> Submit assignment</button>
        </>}
        {canEdit && sub.status === 'submitted' && <>
          <button className="btn btn-primary" onClick={() => setEditing(true)}><Pencil size={16} /> Edit submission</button>
          <button className="btn btn-secondary" onClick={() => setConfirmRemove(true)}><Trash2 size={16} /> Remove submission</button>
        </>}
      </div>
      {canEdit && sub.status !== 'new' && <p className="text-sm muted -mt-3">{sub.status === 'draft' ? 'This submission is a draft. Click “Submit assignment” when you are ready for it to be graded.' : 'You can still make changes to your submission.'}</p>}

      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}><h2 className="font-bold">Submission status</h2></div>
        <Row label="Attempt number">This is attempt 1.</Row>
        <Row label="Submission status" tone={sub.status === 'submitted' ? 'green' : sub.status === 'draft' ? 'amber' : undefined}>{statusText}</Row>
        <Row label="Grading status" tone={graded ? 'green' : undefined}>{graded ? 'Graded' : 'Not graded'}</Row>
        <Row label="Time remaining" tone={remainingTone}>{remaining}</Row>
        <Row label="Last modified">{sub.modifiedAt ? fmtDate(sub.modifiedAt) : '-'}</Row>
        {s.fileSubmissions && <Row label="File submissions">{sub.files.length ? <div className="grid gap-2 max-w-md">{sub.files.map((f, i) => <FileChip key={i} f={f} />)}</div> : <span className="muted">No files</span>}</Row>}
        {s.onlineText && <Row label="Online text">{sub.onlineText ? <div className="whitespace-pre-wrap">{sub.onlineText}</div> : <span className="muted">-</span>}</Row>}
        <Row label="Submission comments"><SubmissionComments k={`${a.id}:${CURRENT_STUDENT_ID}`} /></Row>
      </section>

      {graded && (
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}><h2 className="font-bold">Feedback</h2></div>
          <Row label="Grade"><span className="text-lg font-bold" style={{ color: 'var(--color-heading)' }}>{sub.grade!.toFixed(2)}</span> <span className="muted">/ {s.maxGrade.toFixed(2)}</span></Row>
          <Row label="Graded on">{fmtDate(sub.gradedAt)}</Row>
          <Row label="Feedback comments">{sub.feedback || <span className="muted">-</span>}</Row>
        </section>
      )}

      <Modal open={confirmSubmit} title="Submit assignment" onClose={() => setConfirmSubmit(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setConfirmSubmit(false)}>Cancel</button><button className="btn btn-primary" disabled={!statement} onClick={() => { setConfirmSubmit(false); void submitForGrading(a.id).then((ok) => ok !== undefined && toast('Your assignment has been submitted for grading')) }}>Continue</button></>}>
        <p className="text-sm mb-4">Are you sure you want to submit your work for grading? You will not be able to make any more changes.</p>
        <label className="flex items-start gap-3 p-3 rounded-xl cursor-pointer" style={{ background: 'var(--color-bg-subtle)' }}>
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]" checked={statement} onChange={(e) => setStatement(e.target.checked)} />
          <span className="text-sm" style={{ color: 'var(--color-heading)' }}>This submission is my own work, except where I have acknowledged the use of the works of other people.</span>
        </label>
      </Modal>
      <Confirm open={confirmRemove} danger title="Remove submission" confirmLabel="Continue" onClose={() => setConfirmRemove(false)}
        message="Are you sure you want to remove your submission? Your files and online text will be deleted."
        onConfirm={() => { void removeSubmission(a.id).then((ok) => ok !== undefined && toast('Submission removed')) }} />
    </div>
  )
}

function Notice({ tone, icon: Icon, children }: { tone: 'red' | 'amber' | 'green' | 'blue'; icon: typeof Info; children: ReactNode }) {
  const c = tone === 'blue' ? 'primary' : tone
  return <div className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium" style={{ background: `var(--color-${c}-soft)`, color: `var(--color-${c})` }}><Icon size={18} className="mt-0.5 shrink-0" />{children}</div>
}

function GradingSummary({ a, onView }: { a: Activity; onView: () => void }) {
  const STUDENTS = useEnrolled(useCourseIdOfActivity(a.id))
  const s = a.assign!
  const subs = useLmsStore((st) => st.submissions)
  const submitted = STUDENTS.filter((x) => subs[`${a.id}:${x.id}`]?.status === 'submitted').length
  const drafts = STUDENTS.filter((x) => subs[`${a.id}:${x.id}`]?.status === 'draft').length
  const needs = STUDENTS.filter((x) => { const y = subs[`${a.id}:${x.id}`]; return y?.status === 'submitted' && y.grade === null }).length
  const phase = assignPhase(s)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Participants', value: STUDENTS.length, tone: '#0033A0' },
          { icon: ClipboardCheck, label: 'Submitted', value: submitted, tone: '#16A34A' },
          { icon: Pencil, label: 'Drafts', value: drafts, tone: '#D97706' },
          { icon: AlertTriangle, label: 'Needs grading', value: needs, tone: '#DC2626' },
        ].map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <span className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon size={20} /></span>
            <div><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{value}</div><div className="text-xs font-medium muted">{label}</div></div>
          </div>
        ))}
      </div>
      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}><h2 className="font-bold mr-auto">Grading summary</h2><button className="btn btn-primary btn-sm" onClick={onView}>View all submissions</button></div>
        <Row label="Hidden from students">{a.visible ? 'No' : 'Yes'}</Row>
        <Row label="Accepting submissions" tone={phase === 'open' || phase === 'overdue' ? 'green' : 'red'}>{phase === 'disabled' ? 'No — disabled by lecturer' : phase === 'not-open' ? `Not yet — opens ${fmtShort(s.allowSubmissionsFrom)}` : phase === 'closed' ? 'No — cut-off date has passed' : phase === 'overdue' ? 'Yes (late submissions)' : 'Yes'}</Row>
        <Row label="Participants">{STUDENTS.length}</Row>
        <Row label="Submitted">{submitted}</Row>
        <Row label="Needs grading">{needs}</Row>
        <Row label="Time remaining">{timeLeft(s.dueDate)}</Row>
      </section>
    </div>
  )
}

function SubmissionsTable({ a }: { a: Activity }) {
  const STUDENTS = useEnrolled(useCourseIdOfActivity(a.id))
  const overrides = useAdminStore((x) => x.overrides)
  const s = a.assign!
  const subs = useLmsStore((st) => st.submissions)
  const grade = useLmsStore((st) => st.gradeSubmission)
  const [filter, setFilter] = useState<'all' | 'notsubmitted' | 'submitted' | 'grading'>('all')
  const [quick, setQuick] = useState<Record<string, { g: string; f: string }>>({})
  const [open, setOpen] = useState<string | null>(null)

  const rows = useMemo(() => STUDENTS.map((st) => ({ st, sub: subs[`${a.id}:${st.id}`] ?? { ...EMPTY, studentId: st.id } })).filter(({ sub }) => {
    if (filter === 'notsubmitted') return sub.status !== 'submitted'
    if (filter === 'submitted') return sub.status === 'submitted'
    if (filter === 'grading') return sub.status === 'submitted' && sub.grade === null
    return true
  }), [subs, a.id, filter, STUDENTS])

  const saveAll = () => {
    let n = 0
    for (const [sid, v] of Object.entries(quick)) {
      const g = v.g.trim() === '' ? null : Number(v.g)
      if (g !== null && (isNaN(g) || g < 0 || g > s.maxGrade)) return toast(`Grade must be between 0 and ${s.maxGrade}`, 'error')
      grade(a.id, sid, g, v.f); logAudit('grade', nameOf(sid), `${a.name}: quick grade ${g ?? '-'}`); n++
    }
    setQuick({})
    toast(n ? `${n} grade(s) updated` : 'No changes to save', n ? 'success' : 'info')
  }

  const val = (sid: string, sub: Submission) => quick[sid] ?? { g: sub.grade?.toString() ?? '', f: sub.feedback }
  const openRow = rows.find((r) => r.st.id === open)

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="font-bold mr-auto">Submissions</h2>
        <select className="form-control !w-auto !h-9" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">No filter</option><option value="notsubmitted">Not submitted</option><option value="submitted">Submitted</option><option value="grading">Requires grading</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => toast('Preparing a zip of all submissions…', 'info')}><Download size={15} /> Download all submissions</button>
        <button className="btn btn-primary btn-sm" onClick={saveAll}><Save size={15} /> Save all quick grading changes</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
            {['Student', 'Status', `Grade (/${s.maxGrade})`, 'Last modified', 'File submissions', 'Feedback comments', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(({ st, sub }) => {
              const v = val(st.id, sub)
              const late = sub.modifiedAt && s.dueDate && new Date(sub.modifiedAt) > new Date(s.dueDate)
              return (
                <tr key={st.id} className="border-t align-top" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3"><div className="font-medium" style={{ color: 'var(--color-heading)' }}>{st.name}</div><div className="text-xs muted">{st.email}</div></td>
                  <td className="px-4 py-3 space-y-1">
                    <span className={`badge ${sub.status === 'submitted' ? 'badge-green' : sub.status === 'draft' ? 'badge-amber' : 'badge-gray'}`}>{sub.status === 'submitted' ? 'Submitted for grading' : sub.status === 'draft' ? 'Draft' : 'No submission'}</span>
                    {late && <div><span className="badge badge-red">Late</span></div>}
                    {sub.grade !== null && <div><span className="badge badge-blue">Graded</span></div>}
                    {overrides[`${a.id}:${st.id}`] && <div><span className="badge badge-amber" title={`Previous grade: ${overrides[`${a.id}:${st.id}`].previous}`}>Overridden by Assistant Registrar</span></div>}
                  </td>
                  <td className="px-4 py-3"><input className="form-control !h-9 !w-20" inputMode="decimal" value={v.g} onChange={(e) => setQuick({ ...quick, [st.id]: { ...v, g: e.target.value } })} placeholder="-" /></td>
                  <td className="px-4 py-3 muted whitespace-nowrap">{fmtShort(sub.modifiedAt)}</td>
                  <td className="px-4 py-3">{sub.files.length ? sub.files.map((f, i) => <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-link)' }}><FileText size={13} />{f.name}</div>) : <span className="muted">-</span>}</td>
                  <td className="px-4 py-3"><textarea rows={1} className="form-control !w-56 text-xs" value={v.f} onChange={(e) => setQuick({ ...quick, [st.id]: { ...v, f: e.target.value } })} placeholder="Feedback…" /></td>
                  <td className="px-4 py-3"><button className="btn btn-secondary btn-sm" onClick={() => setOpen(st.id)}>Grade</button></td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center muted">Nothing to display</td></tr>}
          </tbody>
        </table>
      </div>
      {openRow && <GradeDialog a={a} st={openRow.st} sub={openRow.sub} onClose={() => setOpen(null)} />}
    </section>
  )
}

function GradeDialog({ a, st, sub, onClose }: { a: Activity; st: Student; sub: Submission; onClose: () => void }) {
  const s = a.assign!
  const grade = useLmsStore((x) => x.gradeSubmission)
  const setStatus = useLmsStore((x) => x.setSubmissionStatus)
  const [g, setG] = useState(sub.grade?.toString() ?? '')
  const [f, setF] = useState(sub.feedback)
  const commit = () => {
    const n = g.trim() === '' ? null : Number(g)
    if (n !== null && (isNaN(n) || n < 0 || n > s.maxGrade)) return toast(`Grade must be between 0 and ${s.maxGrade}`, 'error')
    grade(a.id, st.id, n, f); logAudit('grade', st.name, `${a.name}: graded ${n ?? '-'}/${s.maxGrade}`); toast(`Grade saved for ${st.name}`); onClose()
  }
  return (
    <Modal open title={`Grade · ${st.name}`} onClose={onClose} width={640}
      footer={<>{sub.status === 'submitted' && <button className="btn btn-secondary mr-auto" onClick={() => { setStatus(a.id, st.id, 'draft'); toast('Submission reverted to draft'); onClose() }}>Revert the submission to draft</button>}<button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={commit}>Save changes</button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><span className={`badge ${sub.status === 'submitted' ? 'badge-green' : 'badge-gray'}`}>{sub.status === 'submitted' ? 'Submitted for grading' : 'No submission'}</span><span className="badge badge-gray">Last modified {fmtShort(sub.modifiedAt)}</span></div>
        {sub.files.length > 0 && <div className="grid gap-2">{sub.files.map((x, i) => <FileChip key={i} f={x} />)}</div>}
        <div><label className="form-label">Grade out of {s.maxGrade}</label><input className="form-control !w-40" inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} autoFocus /></div>
        <div><label className="form-label">Feedback comments</label><textarea rows={5} className="form-control" value={f} onChange={(e) => setF(e.target.value)} /></div>
        <div><div className="form-label">Submission comments</div><SubmissionComments k={`${a.id}:${st.id}`} /></div>
      </div>
    </Modal>
  )
}

function SettingsForm({ a }: { a: Activity }) {
  const update = useLmsStore((st) => st.updateAssign)
  const setVisible = useLmsStore((st) => st.setActivityVisible)
  const [v, setV] = useState<AssignSettings>(a.assign!)
  const [enabled, setEnabled] = useState({ from: !!v.allowSubmissionsFrom, due: !!v.dueDate, cut: !!v.cutOffDate, remind: !!v.remindToGradeBy })
  const [err, setErr] = useState('')
  const set = <K extends keyof AssignSettings>(k: K, val: AssignSettings[K]) => setV((p) => ({ ...p, [k]: val }))

  const save = () => {
    const out: AssignSettings = { ...v, allowSubmissionsFrom: enabled.from ? v.allowSubmissionsFrom : null, dueDate: enabled.due ? v.dueDate : null, cutOffDate: enabled.cut ? v.cutOffDate : null, remindToGradeBy: enabled.remind ? v.remindToGradeBy : null }
    if (out.dueDate && out.allowSubmissionsFrom && out.dueDate < out.allowSubmissionsFrom) return setErr('Due date must be after the allow submissions from date.')
    if (out.cutOffDate && out.dueDate && out.cutOffDate < out.dueDate) return setErr('Cut-off date cannot be earlier than the due date.')
    if (out.remindToGradeBy && out.dueDate && out.remindToGradeBy < out.dueDate) return setErr('Remind me to grade by date cannot be earlier than the due date.')
    if (!out.fileSubmissions && !out.onlineText) return setErr('At least one submission type must be enabled.')
    setErr(''); update(a.id, out); logAudit('settings', a.name, `Assignment settings updated (due ${out.dueDate ? new Date(out.dueDate).toLocaleString() : 'none'})`); toast('Changes saved')
  }

  const dateField = ({ k, flag, label, help }: { k: 'allowSubmissionsFrom' | 'dueDate' | 'cutOffDate' | 'remindToGradeBy'; flag: keyof typeof enabled; label: string; help: string }) => (
    <div key={k} className="grid md:grid-cols-[220px_1fr] gap-2 md:gap-6 items-start">
      <div><div className="form-label !mb-0">{label}</div><div className="text-xs muted">{help}</div></div>
      <div className="flex items-center gap-3">
        <input type="datetime-local" className="form-control !w-64" disabled={!enabled[flag]} value={toLocalInput(v[k])} onChange={(e) => set(k, fromLocalInput(e.target.value))} />
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={enabled[flag]} onChange={(e) => { setEnabled({ ...enabled, [flag]: e.target.checked }); if (e.target.checked && !v[k]) set(k, new Date().toISOString()) }} /> Enable</label>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="w-12 h-12 rounded-2xl grid place-items-center" style={{ background: v.acceptingSubmissions ? 'var(--color-green-soft)' : 'var(--color-red-soft)', color: v.acceptingSubmissions ? 'var(--color-green)' : 'var(--color-red)' }}>{v.acceptingSubmissions ? <Unlock size={22} /> : <Lock size={22} />}</span>
          <div className="flex-1 min-w-[220px]"><div className="font-bold" style={{ color: 'var(--color-heading)' }}>Accept submissions</div><div className="text-sm muted">{v.acceptingSubmissions ? 'Students can add and submit work within the availability dates.' : 'Submissions are disabled. Students cannot add or change submissions.'}</div></div>
          <button className="switch" data-on={v.acceptingSubmissions} onClick={() => { const n = !v.acceptingSubmissions; set('acceptingSubmissions', n); update(a.id, { acceptingSubmissions: n }); logAudit('settings', a.name, n ? 'Submissions enabled' : 'Submissions disabled'); toast(n ? 'Submissions enabled' : 'Submissions disabled') }} aria-label="Toggle accepting submissions" />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-5 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <span className="w-12 h-12 rounded-2xl grid place-items-center" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{a.visible ? <Eye size={22} /> : <EyeOff size={22} />}</span>
          <div className="flex-1 min-w-[220px]"><div className="font-bold" style={{ color: 'var(--color-heading)' }}>Visible to students</div><div className="text-sm muted">{a.visible ? 'Shown on the course page.' : 'Hidden from students.'}</div></div>
          <button className="switch" data-on={a.visible} onClick={() => { setVisible(a.id, !a.visible); logAudit('visibility', a.name, a.visible ? 'Hidden from students' : 'Shown to students'); toast(a.visible ? 'Assignment hidden' : 'Assignment visible') }} aria-label="Toggle visibility" />
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <h2 className="font-bold text-lg">Availability</h2>
        {dateField({ k: 'allowSubmissionsFrom', flag: 'from', label: 'Allow submissions from', help: 'Students cannot submit before this date.' })}
        {dateField({ k: 'dueDate', flag: 'due', label: 'Due date', help: 'Submissions after this date are marked late.' })}
        {dateField({ k: 'cutOffDate', flag: 'cut', label: 'Cut-off date', help: 'No submissions are accepted after this date.' })}
        {dateField({ k: 'remindToGradeBy', flag: 'remind', label: 'Remind me to grade by', help: 'Used for grading reminders on the dashboard.' })}
      </section>

      <section className="card p-6 space-y-5">
        <h2 className="font-bold text-lg">Submission types</h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-heading)' }}><input type="checkbox" className="w-4 h-4" checked={v.onlineText} onChange={(e) => set('onlineText', e.target.checked)} /> Online text</label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-heading)' }}><input type="checkbox" className="w-4 h-4" checked={v.fileSubmissions} onChange={(e) => set('fileSubmissions', e.target.checked)} /> File submissions</label>
        </div>
        {v.fileSubmissions && (
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="form-label">Maximum number of uploaded files</label><select className="form-control" value={v.maxFiles} onChange={(e) => set('maxFiles', Number(e.target.value))}>{Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></div>
            <div><label className="form-label">Maximum submission size</label><select className="form-control" value={v.maxSizeMb} onChange={(e) => set('maxSizeMb', Number(e.target.value))}>{[1, 2, 5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} MB</option>)}</select></div>
            <div><label className="form-label">Accepted file types</label><input className="form-control" value={v.acceptedTypes} onChange={(e) => set('acceptedTypes', e.target.value)} placeholder=".pdf,.docx" /></div>
          </div>
        )}
      </section>

      <section className="card p-6 space-y-5">
        <h2 className="font-bold text-lg">Submission settings & grade</h2>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span><span className="form-label !mb-0">Require students to click the submit button</span><span className="text-xs muted block">If enabled, submissions stay as drafts until students confirm.</span></span>
          <button className="switch" data-on={v.requireSubmitButton} onClick={() => set('requireSubmitButton', !v.requireSubmitButton)} aria-label="Toggle submit button" />
        </label>
        <div><label className="form-label">Maximum grade</label><input type="number" min={1} className="form-control !w-40" value={v.maxGrade} onChange={(e) => set('maxGrade', Math.max(1, Number(e.target.value)))} /></div>
      </section>

      {err && <Notice tone="red" icon={AlertTriangle}>{err}</Notice>}
      <div className="flex gap-2 sticky bottom-4"><button className="btn btn-primary shadow-lg" onClick={save}><Save size={16} /> Save and display</button><button className="btn btn-secondary" onClick={() => { setV(a.assign!); setErr('') }}>Cancel</button></div>
    </div>
  )
}

const NO_COMMENTS: Comment[] = []

export function SubmissionComments({ k }: { k: string }) {
  const me = useMe()
  const comments = useActivityStore((s) => s.comments[k]) ?? NO_COMMENTS
  const add = useActivityStore((s) => s.addComment)
  const del = useActivityStore((s) => s.deleteComment)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  return (
    <div>
      <button className="font-semibold text-sm" style={{ color: 'var(--color-link)' }} onClick={() => setOpen(!open)}>{open ? 'Hide comments' : 'Show comments'} · Comments ({comments.length})</button>
      {open && (
        <div className="mt-3 space-y-2 max-w-xl">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
              <span className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{initials(c.author)}</span>
              <div className="flex-1 min-w-0"><div className="text-xs"><b style={{ color: 'var(--color-heading)' }}>{c.author}</b> <span className="muted">· {fmtShort(c.at)}</span></div><div className="text-sm whitespace-pre-wrap">{c.text}</div></div>
              {(c.authorId === me.id || me.teacher) && <button className="icon-btn !w-7 !h-7" onClick={() => del(k, c.id)} aria-label="Delete comment"><Trash2 size={13} /></button>}
            </div>
          ))}
          <textarea rows={2} className="form-control" placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={() => { const [aid, sid] = k.split(':'); add(Number(aid), sid, text.trim()); setText('') }}>Save comment</button><button className="btn btn-secondary btn-sm" onClick={() => { setText(''); setOpen(false) }}>Cancel</button></div>
        </div>
      )}
    </div>
  )
}

export default function AssignPage() {
  const { courseId, activityId } = useParams()
  const [params, setParams] = useSearchParams()
  const courses = useLmsStore((s) => s.courses)
  const found = useMemo(() => findActivity(courses, Number(activityId)), [courses, activityId])
  const { isTeacher } = useRole()
  if (!found || !found.activity.assign || (!found.activity.visible && !isTeacher)) return <Navigate to={`/courses/${courseId}`} replace />
  const { course, section, activity: a } = found
  const tab = isTeacher ? (params.get('tab') ?? 'overview') : 'overview'

  return (
    <div className="space-y-6 max-w-[1100px]">
      <nav className="text-sm muted flex items-center gap-1.5 flex-wrap">
        <Link to="/dashboard" className="muted hover:underline">Dashboard</Link><span>/</span>
        <Link to={`/courses/${course.id}`} className="muted hover:underline">{course.shortName}</Link><span>/</span>
        <Link to={`/courses/${course.id}#s${section.id}`} className="muted hover:underline">{section.title}</Link><span>/</span>
        <span style={{ color: 'var(--color-heading)' }}>{a.name}</span>
      </nav>

      <div className="card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <ActivityIcon type="assign" size={52} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider muted">Assignment</div>
            <h1 className="text-2xl font-bold">{a.name}</h1>
            {!a.visible && <span className="badge badge-gray mt-2"><EyeOff size={12} /> Hidden from students</span>}
          </div>
        </div>
        <DatesHeader s={a.assign!} />
        {a.description && <p className="text-[15px] leading-relaxed">{a.description}</p>}
        {isTeacher && (
          <div className="flex gap-1 -mb-6 -mx-6 px-4 border-t overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
            {([['overview', 'Overview', Clock], ['submissions', 'Submissions', ClipboardCheck], ['settings', 'Settings', Pencil]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => setParams(k === 'overview' ? {} : { tab: k })} className={`tab flex items-center gap-2 ${tab === k ? 'tab-active' : ''}`}><Icon size={15} />{l}</button>
            ))}
          </div>
        )}
      </div>

      {!isTeacher ? <StudentView a={a} /> : tab === 'settings' ? <SettingsForm key={a.id} a={a} /> : tab === 'submissions' ? <SubmissionsTable a={a} /> : <GradingSummary a={a} onView={() => setParams({ tab: 'submissions' })} />}
      <ActivityNav course={course} current={a.id} />
    </div>
  )
}
