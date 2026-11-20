import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Mail, MapPin, Clock, Building2, Globe, Pencil, MessageCircle, UserPlus, UserMinus, Ban, RotateCcw, Award, Search, BookOpen, Shield, FileText, BarChart3, LogIn } from 'lucide-react'
import { useLmsStore } from '../../store/lmsStore'
import { useAuthStore } from '../../store/authStore'
import { useRole, useUiStore } from '../../store/uiStore'
import { usePrefsStore, BADGES } from '../../store/prefsStore'
import { useSocialStore, PEOPLE } from '../../store/socialStore'
import { Confirm } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { initials } from '../../lib/format'
import { CourseCard } from '../dashboard/components/CourseCard'

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Mail; children: React.ReactNode }) {
  return <section className="card p-6"><h2 className="font-bold flex items-center gap-2 mb-4"><Icon size={17} style={{ color: 'var(--color-primary)' }} />{title}</h2><div className="space-y-2.5 text-sm">{children}</div></section>
}
const Row = ({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) => <div className="flex items-center gap-3"><Icon size={16} className="muted shrink-0" /><span>{children}</span></div>

export function ProfilePage() {
  const { userId } = useParams()
  const user = useAuthStore((s) => s.user)
  const courses = useLmsStore((s) => s.courses)
  const reset = useLmsStore((s) => s.reset)
  const profile = usePrefsStore((s) => s.profile)
  const showBadges = usePrefsStore((s) => s.badges.showOnProfile)
  const social = useSocialStore()
  const openMessages = useUiStore((s) => s.openMessages)
  const { role } = useRole()
  const [confirm, setConfirm] = useState(false)

  const other = userId ? PEOPLE.find((p) => p.id === userId) : null
  const isMe = !other
  const name = isMe ? ([profile.firstName, profile.surname].filter(Boolean).join(' ') || user?.fullName || 'User') : other!.name

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="card overflow-hidden">
        <div className="h-32" style={{ background: 'linear-gradient(120deg,#00267A,#0033A0,#00B3A1)' }} />
        <div className="px-6 pb-6 -mt-12 flex flex-wrap items-end gap-5">
          <span className="w-24 h-24 rounded-3xl grid place-items-center text-3xl font-bold text-white border-4" style={{ background: 'linear-gradient(135deg,#00B3A1,#0033A0)', borderColor: 'var(--color-bg-card)' }}>{initials(name)}</span>
          <div className="flex-1 pb-1 min-w-[200px]"><h1 className="text-2xl font-bold">{name}</h1><div className="text-sm muted">{isMe ? role : other!.role}{isMe && profile.department ? ` · ${profile.department}` : ''}</div></div>
          {isMe ? (
            <Link to="/preferences/profile" className="btn btn-secondary !text-[var(--color-heading)]"><Pencil size={15} /> Edit profile</Link>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => openMessages(other!.id)}><MessageCircle size={15} /> Message</button>
              {social.contacts.includes(other!.id)
                ? <button className="btn btn-secondary" onClick={() => { social.removeContact(other!.id); toast('Removed from contacts') }}><UserMinus size={15} /> Remove from contacts</button>
                : <button className="btn btn-secondary" disabled={social.sentRequests.includes(other!.id)} onClick={() => { social.addContact(other!.id); toast('Contact request sent') }}><UserPlus size={15} /> {social.sentRequests.includes(other!.id) ? 'Contact request sent' : 'Add to contacts'}</button>}
              <button className="btn btn-secondary" onClick={() => { social.blocked.includes(other!.id) ? social.unblock(other!.id) : social.block(other!.id); toast(social.blocked.includes(other!.id) ? 'User unblocked' : 'User blocked') }}><Ban size={15} /> {social.blocked.includes(other!.id) ? 'Unblock user' : 'Block user'}</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card title="User details" icon={Mail}>
          {isMe && <Row icon={Mail}>{user?.email}</Row>}
          {!isMe && <Row icon={Mail}><span className="muted">Email hidden</span></Row>}
          <Row icon={MapPin}>{profile.city ? `${profile.city}, ` : ''}{profile.country}</Row>
          <Row icon={Clock}>Timezone: {profile.timezone}</Row>
          {isMe && profile.institution && <Row icon={Building2}>{profile.institution}</Row>}
          {isMe && profile.webPage && <Row icon={Globe}><a href={profile.webPage} target="_blank" rel="noreferrer">{profile.webPage}</a></Row>}
          {isMe && profile.interests && <div className="flex flex-wrap gap-1.5 pt-1">{profile.interests.split(',').map((i) => i.trim()).filter(Boolean).map((i) => <span key={i} className="badge badge-blue">{i}</span>)}</div>}
          {isMe && profile.description && <p className="pt-2 muted">{profile.description}</p>}
        </Card>
        <Card title="Course details" icon={BookOpen}>
          <div className="text-xs font-semibold muted">Course profiles</div>
          <div className="flex flex-col gap-1.5">{courses.map((c) => <Link key={c.id} to={`/courses/${c.id}`} className="truncate">{c.shortName} {c.fullName}</Link>)}</div>
        </Card>
        {isMe && <>
          <Card title="Privacy and policies" icon={Shield}>
            <Link to="/page/guidelines" className="block">Data retention summary</Link>
            <Link to="/page/guidelines" className="block">Policies and agreements</Link>
          </Card>
          <Card title="Miscellaneous" icon={FileText}>
            <Link to="/courses" className="block">Forum posts</Link>
            <Link to="/courses" className="block">Forum discussions</Link>
            <Link to="/notifications" className="block">Notifications</Link>
          </Card>
          <Card title="Reports" icon={BarChart3}>
            <span className="block">Browser sessions: 1 active (this device)</span>
            <Link to="/grades" className="block">Grades overview</Link>
          </Card>
          <Card title="Login activity" icon={LogIn}>
            <div><span className="muted">First access to site:</span> Monday, 4 March 2024</div>
            <div><span className="muted">Last access to site:</span> now</div>
          </Card>
          {showBadges && (
            <Card title="Badges" icon={Award}>
              <div className="flex flex-wrap gap-3">{BADGES.map((b) => <Link key={b.id} to="/badges" title={b.name} className="w-12 h-12 rounded-full grid place-items-center text-white" style={{ background: b.color }}><Award size={22} /></Link>)}</div>
            </Card>
          )}
          <Card title="Demo data" icon={RotateCcw}>
            <p className="muted">Restore all sample courses, submissions and grades to their initial state.</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}><RotateCcw size={14} /> Reset demo data</button>
          </Card>
        </>}
      </div>
      <Confirm open={confirm} danger title="Reset demo data?" confirmLabel="Reset" message="All changes to submissions, grades, activities and events will be lost." onConfirm={() => { reset(); toast('Demo data restored') }} onClose={() => setConfirm(false)} />
    </div>
  )
}

export function BadgesPage() {
  const [sel, setSel] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const list = BADGES.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()))
  const b = BADGES.find((x) => x.id === sel)
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto"><h1 className="text-2xl font-bold">Manage badges</h1><p className="text-sm muted">Badges you have earned in your courses.</p></div>
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9 !w-56" placeholder="Search badges" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Link to="/preferences/badges" className="btn btn-secondary btn-sm !text-[var(--color-heading)]">Badge preferences</Link>
      </div>
      {list.length === 0 ? <div className="card p-12 text-center muted">You currently have no badges to display.</div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className="card p-6 text-center hover:-translate-y-0.5 transition-transform">
              <span className="w-20 h-20 mx-auto rounded-full grid place-items-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${x.color}, color-mix(in srgb, ${x.color} 50%, #000))` }}><Award size={38} /></span>
              <div className="font-bold mt-4" style={{ color: 'var(--color-heading)' }}>{x.name}</div>
              <div className="text-xs muted mt-1">{x.course} · Issued {x.issued}</div>
            </button>
          ))}
        </div>
      )}
      {b && (
        <div className="card p-6 flex flex-wrap gap-6 items-center animate-in">
          <span className="w-24 h-24 rounded-full grid place-items-center text-white" style={{ background: b.color }}><Award size={44} /></span>
          <div className="flex-1 min-w-[220px]"><h2 className="text-xl font-bold">{b.name}</h2><p className="mt-1">{b.description}</p><div className="text-sm muted mt-2">Issued by Altus Vera · {b.course} · {b.issued}</div></div>
          <button className="btn btn-secondary" onClick={() => toast(`Downloading ${b.name}.png`, 'info')}>Download</button>
        </div>
      )}
    </div>
  )
}

export function CourseSearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [text, setText] = useState(q)
  const courses = useLmsStore((s) => s.courses)
  const res = useMemo(() => { const t = q.trim().toLowerCase(); return t ? courses.filter((c) => `${c.shortName} ${c.fullName} ${c.category} ${c.lecturer}`.toLowerCase().includes(t)) : [] }, [q, courses])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search courses</h1>
      <form className="flex gap-2 max-w-xl" onSubmit={(e) => { e.preventDefault(); setParams(text.trim() ? { q: text.trim() } : {}) }}>
        <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-10" value={text} onChange={(e) => setText(e.target.value)} placeholder="Course name, code, faculty or lecturer" autoFocus /></div>
        <button className="btn btn-primary">Go</button>
      </form>
      {q && <p className="text-sm muted">Search results: {res.length}</p>}
      {q && res.length === 0 && <div className="card p-12 text-center muted">No courses were found with the words “{q}”</div>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{res.map((c) => <CourseCard key={c.id} course={c} />)}</div>
    </div>
  )
}
