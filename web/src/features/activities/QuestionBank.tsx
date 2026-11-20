import { useMemo, useState } from 'react'
import { Plus, Upload, Search, Pencil, Trash2, Database, CheckCircle2, X, Layers } from 'lucide-react'
import type { Course } from '../../store/lmsStore'
import { Modal, Confirm } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { errorMessage } from '../../services/sync'
import { useQuestionBank, useInvalidateBank, saveQuestion, deleteQuestion, importQuestions, type BankQuestion } from './questionBankApi'

type Draft = { id?: number; category: string; text: string; options: string[]; correctIndex: number; explanation: string }
const blank = (category = 'General'): Draft => ({ category, text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' })

const SAMPLE = `What does SWOT stand for?
Sales, Wages, Operations, Taxes
*Strengths, Weaknesses, Opportunities, Threats
Strategy, Work, Objectives, Targets

Which force is NOT part of Porter's Five Forces?
Threat of substitutes
*Government regulation
Bargaining power of buyers
Rivalry among competitors`

export function QuestionBank({ course }: { course: Course }) {
  const { data, isLoading, error } = useQuestionBank(course.id)
  const invalidate = useInvalidateBank()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [del, setDel] = useState<BankQuestion | null>(null)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [importCat, setImportCat] = useState('General')

  const questions = data ?? []
  const categories = useMemo(() => [...new Set(questions.map((x) => x.category))].sort(), [questions])
  const rows = questions.filter((x) => (category === 'All' || x.category === category) && `${x.text} ${x.options.join(' ')}`.toLowerCase().includes(q.toLowerCase()))

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await saveQuestion(course.id, draft)
      toast(draft.id ? 'Question updated' : 'Question added to the bank')
      setDraft(null)
      await invalidate(course.id)
    } catch (e) { toast(errorMessage(e), 'error') } finally { setSaving(false) }
  }
  const runImport = async () => {
    setSaving(true)
    try {
      const { data: r } = await importQuestions(course.id, importCat, importText)
      toast(`${r.imported} question(s) imported`)
      setImporting(false); setImportText('')
      await invalidate(course.id)
    } catch (e) { toast(errorMessage(e), 'error') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-5 flex items-center gap-4"><span className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}><Database size={20} /></span><div><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{questions.length}</div><div className="text-xs muted">Questions in bank</div></div></div>
        <div className="card p-5 flex items-center gap-4"><span className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}><Layers size={20} /></span><div><div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{categories.length}</div><div className="text-xs muted">Categories</div></div></div>
        <div className="card p-5 col-span-2 text-sm">
          <div className="font-semibold mb-1" style={{ color: 'var(--color-heading)' }}>How quizzes use the bank</div>
          <p className="muted">Each quiz draws a set number of questions at random (from all questions or one category) when a student starts an attempt, so students receive different papers. Question and answer order can also be shuffled in the quiz settings.</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-bold mr-auto">Question bank · {course.shortName}</h2>
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9 !h-9 !w-56" placeholder="Search questions" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="form-control !w-auto !h-9" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="All">All categories ({questions.length})</option>
            {categories.map((c) => <option key={c} value={c}>{c} ({questions.filter((x) => x.category === c).length})</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => { setImportCat(category === 'All' ? 'General' : category); setImporting(true) }}><Upload size={14} /> Import</button>
          <button className="btn btn-primary btn-sm" onClick={() => setDraft(blank(category === 'All' ? (categories[0] ?? 'General') : category))}><Plus size={15} /> Add question</button>
        </div>
        {isLoading ? <div className="p-10 text-center muted">Loading questions…</div> : error ? <div className="p-10 text-center" style={{ color: 'var(--color-red)' }}>{errorMessage(error)}</div> : rows.length === 0 ? (
          <div className="p-12 text-center"><Database size={32} className="mx-auto muted" /><p className="mt-2 muted">{questions.length ? 'No questions match your filters.' : 'The question bank is empty. Add questions or import them in bulk.'}</p></div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {rows.map((x, i) => (
              <div key={x.id} className="p-5 flex gap-4 hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-bold muted w-8 shrink-0 pt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2"><span className="badge badge-blue">{x.category}</span><span className="font-medium" style={{ color: 'var(--color-heading)' }}>{x.text}</span></div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                    {x.options.map((o, oi) => <div key={oi} className="text-sm flex items-center gap-1.5" style={{ color: oi === x.correctIndex ? 'var(--color-green)' : 'var(--color-text)', fontWeight: oi === x.correctIndex ? 600 : 400 }}>{oi === x.correctIndex ? <CheckCircle2 size={14} /> : <span className="w-3.5" />}{String.fromCharCode(97 + oi)}. {o}</div>)}
                  </div>
                  {x.explanation && <p className="text-xs muted mt-2">Explanation: {x.explanation}</p>}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button className="icon-btn !w-8 !h-8" title="Edit" onClick={() => setDraft({ id: x.id, category: x.category, text: x.text, options: [...x.options], correctIndex: x.correctIndex, explanation: x.explanation ?? '' })}><Pencil size={15} /></button>
                  <button className="icon-btn !w-8 !h-8" title="Delete" onClick={() => setDel(x)}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={!!draft} title={draft?.id ? 'Edit question' : 'Add question'} onClose={() => setDraft(null)} width={680}
        footer={<><button className="btn btn-secondary" onClick={() => setDraft(null)}>Cancel</button><button className="btn btn-primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save question'}</button></>}>
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="form-label">Category</label>
              <input className="form-control" list="bank-categories" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Strategic analysis" />
              <datalist id="bank-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div><label className="form-label">Question text *</label><textarea rows={3} className="form-control" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} autoFocus /></div>
            <div>
              <label className="form-label">Answer options * <span className="font-normal muted">(select the correct one)</span></label>
              <div className="space-y-2">
                {draft.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" name="correct" className="w-4 h-4 accent-[var(--color-green)]" checked={draft.correctIndex === oi} onChange={() => setDraft({ ...draft, correctIndex: oi })} aria-label={`Option ${oi + 1} is correct`} />
                    <span className="text-sm font-semibold muted w-5">{String.fromCharCode(97 + oi)}.</span>
                    <input className="form-control" value={o} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === oi ? e.target.value : x)) })} placeholder={`Option ${oi + 1}`} />
                    {draft.options.length > 2 && <button className="icon-btn !w-8 !h-8" onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== oi), correctIndex: draft.correctIndex === oi ? 0 : draft.correctIndex > oi ? draft.correctIndex - 1 : draft.correctIndex })} aria-label="Remove option"><X size={15} /></button>}
                  </div>
                ))}
              </div>
              {draft.options.length < 6 && <button className="btn btn-ghost btn-sm mt-2" onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}><Plus size={14} /> Add option</button>}
            </div>
            <div><label className="form-label">Explanation <span className="font-normal muted">(shown in the attempt review)</span></label><textarea rows={2} className="form-control" value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></div>
          </div>
        )}
      </Modal>

      <Modal open={importing} title="Import questions" onClose={() => setImporting(false)} width={700}
        footer={<><button className="btn btn-secondary" onClick={() => setImporting(false)}>Cancel</button><button className="btn btn-primary" disabled={saving || !importText.trim()} onClick={() => void runImport()}><Upload size={15} /> {saving ? 'Importing…' : 'Import'}</button></>}>
        <div className="space-y-4">
          <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--color-bg-subtle)' }}>
            <div className="font-semibold mb-1" style={{ color: 'var(--color-heading)' }}>Format</div>
            Write each question on one line followed by its options on the next lines. Mark the correct option with <b>*</b>. Leave a blank line between questions.
            <button className="block mt-2 font-semibold" style={{ color: 'var(--color-link)' }} onClick={() => setImportText(SAMPLE)}>Insert an example</button>
          </div>
          <div><label className="form-label">Category for imported questions</label><input className="form-control" list="bank-categories" value={importCat} onChange={(e) => setImportCat(e.target.value)} /></div>
          <div><label className="form-label">Questions</label><textarea rows={12} className="form-control font-mono text-xs" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={SAMPLE} /></div>
          <p className="text-xs muted">{importText.trim() ? `${importText.trim().split(/\n\s*\n/).length} question block(s) detected` : 'Nothing pasted yet'}</p>
        </div>
      </Modal>

      <Confirm open={!!del} danger title="Delete question" confirmLabel="Delete" message={<>Delete this question from the bank? Quizzes will no longer draw it.<br /><br /><b>{del?.text}</b></>}
        onConfirm={async () => { try { await deleteQuestion(del!.id); toast('Question deleted'); await invalidate(course.id) } catch (e) { toast(errorMessage(e), 'error') } }} onClose={() => setDel(null)} />
    </div>
  )
}
