import { useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { UploadCloud, FileText, Trash2, Download, Library, ScrollText, MessageSquareWarning, Send, Megaphone } from 'lucide-react'
import { useLmsStore } from '../../store/lmsStore'
import { CourseCard } from '../dashboard/components/CourseCard'
import { toast } from '../../components/Toast'
import { fmtShort, fmtSize } from '../../lib/format'

export function CoursesPage() {
  const courses = useLmsStore((s) => s.courses)
  const cats = [...new Set(courses.map((c) => c.category))]
  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-bold">My courses</h1><p className="text-sm muted">All courses you are enrolled in, grouped by faculty.</p></div>
      {cats.map((cat) => (
        <section key={cat}>
          <h2 className="text-lg font-bold mb-4">{cat}</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{courses.filter((c) => c.category === cat).map((c) => <CourseCard key={c.id} course={c} />)}</div>
        </section>
      ))}
    </div>
  )
}

export function SiteHomePage() {
  const courses = useLmsStore((s) => s.courses)
  const news = [
    { t: 'Semester 1 examination timetable released', d: 'The final examination timetable for Semester 1 is now available on the Student Guidelines page.', at: 2 },
    { t: 'Library extended opening hours', d: 'The main library will remain open until 10:00 PM during the examination period.', at: 5 },
    { t: 'Altus Vera LMS mobile app', d: 'Access your courses on the go — download the mobile app from the App Store or Google Play.', at: 9 },
  ]
  return (
    <div className="space-y-8">
      <div className="rounded-3xl p-8 text-white" style={{ background: 'linear-gradient(120deg,#00267A,#00B3A1)' }}>
        <h1 className="!text-white text-3xl font-bold">Welcome to Altus Vera LMS</h1>
        <p className="text-white/80 mt-2 max-w-2xl">Your learning platform for lecture materials, assignments, quizzes and grades.</p>
      </div>
      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Megaphone size={18} style={{ color: 'var(--color-primary)' }} /> Site announcements</h2>
          <div className="space-y-3">{news.map((n) => (
            <article key={n.t} className="card p-5"><div className="text-xs muted mb-1">{fmtShort(new Date(Date.now() - n.at * 864e5).toISOString())} · Site administrator</div><h3 className="font-bold">{n.t}</h3><p className="text-sm mt-1">{n.d}</p></article>
          ))}</div>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-4">Course categories</h2>
          <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {[...new Set(courses.map((c) => c.category))].map((cat) => (
              <Link key={cat} to="/courses" className="flex justify-between p-4 hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-heading)' }}><span className="font-medium">{cat}</span><span className="badge badge-gray">{courses.filter((c) => c.category === cat).length}</span></Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function FilesPage() {
  const [files, setFiles] = useState<{ name: string; size: number; at: string }[]>([])
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const add = (l: FileList | null) => {
    if (!l) return
    const total = files.reduce((n, f) => n + f.size, 0) + Array.from(l).reduce((n, f) => n + f.size, 0)
    if (total > 100 * 1_048_576) return toast('Private files quota (100 MB) exceeded', 'error')
    setFiles([...files, ...Array.from(l).map((f) => ({ name: f.name, size: f.size, at: new Date().toISOString() }))])
    toast(`${l.length} file(s) uploaded`)
  }
  const used = files.reduce((n, f) => n + f.size, 0)
  return (
    <div className="space-y-6 max-w-4xl">
      <div><h1 className="text-2xl font-bold">Private files</h1><p className="text-sm muted">Files stored here are only visible to you. Maximum 100 MB.</p></div>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }} onClick={() => input.current?.click()}
        className={`card border-2 border-dashed p-10 text-center cursor-pointer ${drag ? '!border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : ''}`}>
        <UploadCloud size={40} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
        <div className="mt-2 font-semibold" style={{ color: 'var(--color-heading)' }}>Drag and drop files here, or click to browse</div>
        <input ref={input} type="file" hidden multiple onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>
      <div className="card">
        <div className="flex justify-between p-5 border-b text-sm" style={{ borderColor: 'var(--color-border)' }}><span className="font-bold" style={{ color: 'var(--color-heading)' }}>{files.length} files</span><span className="muted">{fmtSize(used || 1)} of 100 MB used</span></div>
        {files.length === 0 ? <div className="p-10 text-center muted text-sm">No files available</div> : files.map((f, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3 border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
            <FileText size={18} className="muted" /><span className="flex-1 truncate" style={{ color: 'var(--color-heading)' }}>{f.name}</span><span className="text-xs muted">{fmtSize(f.size)}</span>
            <button className="icon-btn !w-8 !h-8" onClick={() => toast(`Downloading ${f.name}`, 'info')}><Download size={15} /></button>
            <button className="icon-btn !w-8 !h-8" onClick={() => { setFiles(files.filter((_, j) => j !== i)); toast('File deleted') }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

const PAGES = {
  references: { title: 'Online Reference Materials', icon: Library, items: ['Emerald Insight — Management journals', 'IEEE Xplore Digital Library', 'ScienceDirect (Elsevier)', 'SpringerLink e-books', 'JSTOR Arts & Sciences', 'O’Reilly Learning Platform'] },
  guidelines: { title: 'Student Guidelines', icon: ScrollText, items: ['Academic integrity & plagiarism policy', 'Assignment submission guidelines', 'Late submission & extension procedure', 'Examination rules and regulations', 'Referencing guide (Harvard style)', 'Student code of conduct'] },
} as const

export function InfoPage() {
  const { slug } = useParams()
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ type: 'Feedback', subject: '', message: '' })
  if (slug === 'feedback') return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3"><MessageSquareWarning size={28} style={{ color: 'var(--color-primary)' }} /><h1 className="text-2xl font-bold">Feedback & Complaints</h1></div>
      {sent ? <div className="card p-10 text-center"><Send size={36} className="mx-auto" style={{ color: 'var(--color-green)' }} /><div className="mt-3 font-bold" style={{ color: 'var(--color-heading)' }}>Thank you!</div><p className="text-sm muted">Your submission has been received. We will respond within 3 working days.</p><button className="btn btn-secondary mt-4" onClick={() => { setSent(false); setForm({ type: 'Feedback', subject: '', message: '' }) }}>Submit another</button></div> : (
        <div className="card p-6 space-y-4">
          <div><label className="form-label">Type</label><select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Feedback</option><option>Complaint</option><option>Technical issue</option></select></div>
          <div><label className="form-label">Subject *</label><input className="form-control" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="form-label">Message *</label><textarea rows={6} className="form-control" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={!form.subject.trim() || !form.message.trim()} onClick={() => setSent(true)}><Send size={16} /> Submit</button>
        </div>
      )}
    </div>
  )
  const page = PAGES[slug as keyof typeof PAGES]
  if (!page) return <Navigate to="/dashboard" replace />
  const Icon = page.icon
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3"><Icon size={28} style={{ color: 'var(--color-primary)' }} /><h1 className="text-2xl font-bold">{page.title}</h1></div>
      <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {page.items.map((i) => <button key={i} onClick={() => toast(`Opening ${i}`, 'info')} className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}><FileText size={18} className="muted" /><span style={{ color: 'var(--color-heading)' }}>{i}</span></button>)}
      </div>
    </div>
  )
}
