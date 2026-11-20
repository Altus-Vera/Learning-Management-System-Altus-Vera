import { useState } from 'react'
import { CheckCircle2, BarChart3, ListChecks, Eye, Users, Save, Pencil, Download } from 'lucide-react'
import { useActivityStore, FEEDBACK_QUESTIONS, RATING_LABELS, seedFeedback, seedGroups, useMe } from '../../store/activityStore'
import { useLmsStore, type Activity } from '../../store/lmsStore'
import { Confirm } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { fmtShort } from '../../lib/format'

export function FeedbackView({ a }: { a: Activity }) {
  const me = useMe()
  const responses = useActivityStore((s) => s.feedback[a.id]) ?? seedFeedback()
  const done = useActivityStore((s) => !!s.feedbackDone[`${a.id}:${me.id}`])
  const submit = useActivityStore((s) => s.submitFeedback)
  const [tab, setTab] = useState<'overview' | 'analysis' | 'responses'>('overview')
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [err, setErr] = useState('')
  const [filling, setFilling] = useState(false)

  if (me.teacher) {
    return (
      <div className="space-y-4">
        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {([['overview', 'Overview', Eye], ['analysis', 'Analysis', BarChart3], ['responses', 'Show responses', ListChecks]] as const).map(([k, l, Icon]) => <button key={k} className={`tab flex items-center gap-2 ${tab === k ? 'tab-active' : ''}`} onClick={() => setTab(k)}><Icon size={15} />{l}</button>)}
        </div>
        {tab === 'overview' && <div className="card p-6 space-y-2"><p>{a.description}</p><div className="text-sm"><span className="muted">Submitted answers:</span> <b style={{ color: 'var(--color-heading)' }}>{responses.length}</b></div><div className="text-sm"><span className="muted">Questions:</span> {FEEDBACK_QUESTIONS.length}</div><div className="text-sm"><span className="muted">Mode:</span> Anonymous</div></div>}
        {tab === 'analysis' && (
          <div className="space-y-4">
            <div className="flex justify-end"><button className="btn btn-secondary btn-sm" onClick={() => toast('Exporting to Excel…', 'info')}><Download size={14} /> Export to Excel</button></div>
            {FEEDBACK_QUESTIONS.filter((q) => q.type === 'rating').map((q, qi) => {
              const counts = [1, 2, 3, 4, 5].map((v) => responses.filter((r) => r.answers[q.id] === v).length)
              const total = counts.reduce((x, y) => x + y, 0) || 1
              const avg = counts.reduce((n, c, i) => n + c * (i + 1), 0) / total
              return (
                <div key={q.id} className="card p-5">
                  <div className="flex items-start gap-3 mb-4"><span className="badge badge-blue">Q{qi + 1}</span><div className="flex-1 font-semibold" style={{ color: 'var(--color-heading)' }}>{q.text}</div><span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>Average: {avg.toFixed(2)}</span></div>
                  <div className="space-y-2">{counts.map((c, i) => (
                    <div key={i} className="grid grid-cols-[140px_1fr_70px] items-center gap-3 text-sm">
                      <span className="muted">{RATING_LABELS[i]}</span>
                      <div className="h-6 rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-subtle)' }}><div className="h-full rounded-lg" style={{ width: `${(c / total) * 100}%`, background: 'var(--color-primary)' }} /></div>
                      <span className="text-right muted">{c} ({Math.round((c / total) * 100)}%)</span>
                    </div>
                  ))}</div>
                </div>
              )
            })}
            <div className="card p-5"><div className="font-semibold mb-3" style={{ color: 'var(--color-heading)' }}>{FEEDBACK_QUESTIONS[5].text}</div><ul className="space-y-2 text-sm">{responses.map((r) => r.answers.q6).filter(Boolean).map((t, i) => <li key={i} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>{String(t)}</li>)}</ul></div>
          </div>
        )}
        {tab === 'responses' && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}><th className="px-4 py-3">Response</th><th className="px-4 py-3">Date</th>{FEEDBACK_QUESTIONS.map((q, i) => <th key={q.id} className="px-4 py-3">Q{i + 1}</th>)}</tr></thead>
              <tbody>{responses.map((r, i) => <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="px-4 py-2.5">Anonymous #{i + 1}</td><td className="px-4 py-2.5 muted whitespace-nowrap">{fmtShort(r.at)}</td>{FEEDBACK_QUESTIONS.map((q) => <td key={q.id} className="px-4 py-2.5 max-w-[200px] truncate">{String(r.answers[q.id] ?? '') || '-'}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (done) return <div className="card p-10 text-center"><CheckCircle2 size={44} className="mx-auto" style={{ color: 'var(--color-green)' }} /><div className="font-bold mt-3" style={{ color: 'var(--color-heading)' }}>Thank you for your valuable feedback.</div><p className="text-sm muted">You've already completed this activity.</p></div>
  if (!filling) return (
    <div className="card p-6 space-y-3">
      <p className="leading-relaxed">{a.description}</p>
      <p className="text-sm muted">Mode: Anonymous · {FEEDBACK_QUESTIONS.length} questions</p>
      <button className="btn btn-primary" onClick={() => setFilling(true)}><Pencil size={15} /> Answer the questions</button>
    </div>
  )
  const send = () => {
    const missing = FEEDBACK_QUESTIONS.filter((q) => q.type === 'rating' && answers[q.id] === undefined)
    if (missing.length) return setErr('There are required fields in this form that must be completed.')
    submit(a.id, me.id, answers); toast('Your answers have been saved. Thank you.')
  }
  return (
    <div className="space-y-4">
      {FEEDBACK_QUESTIONS.map((q, i) => (
        <div key={q.id} className="card p-5">
          <div className="font-semibold mb-3" style={{ color: 'var(--color-heading)' }}>{i + 1}. {q.text} {q.type === 'rating' && <span style={{ color: 'var(--color-red)' }}>*</span>}</div>
          {q.type === 'rating' ? (
            <div className="grid grid-cols-5 gap-2">{RATING_LABELS.map((l, v) => (
              <button key={l} onClick={() => setAnswers((p) => ({ ...p, [q.id]: v + 1 }))} className={`p-3 rounded-xl border-2 text-xs font-semibold text-center transition-colors ${answers[q.id] === v + 1 ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'border-transparent hover:bg-[var(--color-bg-subtle)]'}`} style={{ background: answers[q.id] === v + 1 ? undefined : 'var(--color-bg-subtle)' }}>
                <span className="block text-lg mb-1">{v + 1}</span>{l}
              </button>
            ))}</div>
          ) : <textarea rows={4} className="form-control" value={String(answers[q.id] ?? '')} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />}
        </div>
      ))}
      {err && <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--color-red-soft)', color: 'var(--color-red)' }}>{err}</div>}
      <div className="flex gap-2"><button className="btn btn-primary" onClick={send}>Submit your answers</button><button className="btn btn-secondary" onClick={() => setFilling(false)}>Cancel</button></div>
    </div>
  )
}

export function ChoiceGroupView({ a }: { a: Activity }) {
  const me = useMe()
  const groups = useActivityStore((s) => s.groups[a.id]) ?? seedGroups()
  const join = useActivityStore((s) => s.joinGroup)
  const [showDesc, setShowDesc] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const mine = groups.find((g) => g.members.includes(me.name))
  const [pick, setPick] = useState<number | null>(mine?.id ?? null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div className="space-y-4">
      {a.description && <p className="muted">{a.description}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary btn-sm" onClick={() => setShowDesc(!showDesc)}>{showDesc ? 'Hide descriptions' : 'Show descriptions'}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowMembers(!showMembers)}><Users size={14} /> {showMembers ? 'Hide group members' : 'Show group members'}</button>
      </div>
      {mine && !me.teacher && <div className="p-4 rounded-2xl text-sm font-medium" style={{ background: 'var(--color-green-soft)', color: 'var(--color-green)' }}>Your current selection: {mine.name}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>{!me.teacher && <th className="px-4 py-3 w-12" />}<th className="px-4 py-3">Group</th><th className="px-4 py-3">Members / Capacity</th>{showMembers && <th className="px-4 py-3">Group members</th>}</tr></thead>
          <tbody>
            {groups.map((g) => {
              const full = g.members.length >= g.capacity && mine?.id !== g.id
              return (
                <tr key={g.id} className={`border-t ${full ? 'opacity-60' : ''}`} style={{ borderColor: 'var(--color-border)' }}>
                  {!me.teacher && <td className="px-4 py-3"><input type="radio" name="grp" disabled={full} checked={pick === g.id} onChange={() => setPick(g.id)} className="w-4 h-4 accent-[var(--color-primary)]" aria-label={g.name} /></td>}
                  <td className="px-4 py-3"><div className="font-semibold" style={{ color: 'var(--color-heading)' }}>{g.name} {full && <span className="badge badge-red ml-1">Full</span>}</div>{showDesc && <div className="text-xs muted mt-0.5">{g.description}</div>}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-subtle)' }}><div className="h-full" style={{ width: `${(g.members.length / g.capacity) * 100}%`, background: full ? 'var(--color-red)' : 'var(--color-primary)' }} /></div>{g.members.length} / {g.capacity}</div></td>
                  {showMembers && <td className="px-4 py-3 text-xs muted">{g.members.join(', ') || '-'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!me.teacher && (
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={pick === null || pick === mine?.id} onClick={() => { join(a.id, pick, me.name); toast('Your selection has been saved') }}><Save size={15} /> Save my choice</button>
          {mine && <button className="btn btn-secondary" onClick={() => setConfirmRemove(true)}>Remove my choice</button>}
        </div>
      )}
      <Confirm open={confirmRemove} title="Remove my choice" confirmLabel="Remove" message={`Remove yourself from ${mine?.name}?`} onConfirm={() => { join(a.id, null, me.name); setPick(null); toast('Your choice has been removed') }} onClose={() => setConfirmRemove(false)} />
    </div>
  )
}

export function PageView({ a }: { a: Activity }) {
  const me = useMe()
  const update = useLmsStore((s) => s.updateActivity)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(a.content ?? '')
  return (
    <div className="card p-6">
      {editing ? (
        <div className="space-y-3"><textarea rows={14} className="form-control font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} /><div className="flex gap-2"><button className="btn btn-primary" onClick={() => { update(a.id, { content: text }); setEditing(false); toast('Changes saved') }}><Save size={15} /> Save and display</button><button className="btn btn-secondary" onClick={() => { setText(a.content ?? ''); setEditing(false) }}>Cancel</button></div></div>
      ) : (
        <>
          <div className="whitespace-pre-line leading-relaxed text-[15px]">{a.content || <span className="muted">This page is empty.</span>}</div>
          <div className="flex items-center justify-between mt-6 pt-4 border-t text-xs muted" style={{ borderColor: 'var(--color-border)' }}>
            <span>Last modified: {fmtShort(new Date().toISOString())}</span>
            {me.teacher && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit page</button>}
          </div>
        </>
      )}
    </div>
  )
}
