import { Fragment, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { UserCog, Languages, MessagesSquare, Type, BookOpen, CalendarDays, MessageCircle, Bell, Award, KeyRound, ChevronRight, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { isAxiosError } from 'axios'
import { usePrefsStore, NOTIF_COMPONENTS, notifDefault, type Profile } from '../../store/prefsStore'
import { useSocialStore } from '../../store/socialStore'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { api } from '../../services/api'
import { toast } from '../../components/Toast'

const SECTIONS = [
  { group: 'User account', items: [
    { slug: 'profile', label: 'Edit profile', icon: UserCog },
    { slug: 'password', label: 'Change password', icon: KeyRound },
    { slug: 'language', label: 'Preferred language', icon: Languages },
    { slug: 'forum', label: 'Forum preferences', icon: MessagesSquare },
    { slug: 'editor', label: 'Editor preferences', icon: Type },
    { slug: 'course', label: 'Course preferences', icon: BookOpen },
    { slug: 'calendar', label: 'Calendar preferences', icon: CalendarDays },
    { slug: 'messages', label: 'Message preferences', icon: MessageCircle },
    { slug: 'notifications', label: 'Notification preferences', icon: Bell },
  ] },
  { group: 'Badges', items: [
    { slug: 'badges', label: 'Badge preferences', icon: Award },
  ] },
]
const ALL = SECTIONS.flatMap((s) => s.items)

export function PreferencesHub() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div><h1 className="text-2xl font-bold">Preferences</h1><p className="text-sm muted">Manage your account, notifications and display settings.</p></div>
      {SECTIONS.map((s) => (
        <section key={s.group}>
          <h2 className="text-sm font-bold uppercase tracking-wider muted mb-3">{s.group}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {s.items.map(({ slug, label, icon: Icon }) => (
              <Link key={slug} to={`/preferences/${slug}`} className="card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform !text-inherit">
                <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}><Icon size={19} /></span>
                <span className="font-semibold flex-1" style={{ color: 'var(--color-heading)' }}>{label}</span>
                <ChevronRight size={17} className="muted" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Shell({ title, children, onSave }: { title: string; children: ReactNode; onSave?: () => void }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <nav className="text-sm muted flex gap-1.5"><Link to="/preferences" className="muted hover:underline">Preferences</Link><span>/</span><span style={{ color: 'var(--color-heading)' }}>{title}</span></nav>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="card p-6 space-y-5">{children}</div>
      {onSave && <div className="flex gap-2"><button className="btn btn-primary" onClick={onSave}><Save size={16} /> Save changes</button><Link to="/preferences" className="btn btn-secondary !text-[var(--color-heading)]">Cancel</Link></div>}
    </div>
  )
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <div className="grid md:grid-cols-[220px_1fr] gap-2 md:gap-6 items-start"><div><div className="form-label !mb-0">{label}</div>{help && <div className="text-xs muted">{help}</div>}</div><div>{children}</div></div>
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" data-on={on} onClick={() => onChange(!on)} aria-label={label} />
}

function ProfileForm() {
  const user = useAuthStore((s) => s.user)
  const stored = usePrefsStore((s) => s.profile)
  const update = usePrefsStore((s) => s.updateProfile)
  const [first, ...rest] = (user?.fullName ?? '').split(' ')
  const [p, setP] = useState<Profile>({ ...stored, firstName: stored.firstName || first || '', surname: stored.surname || rest.join(' ') })
  const [more, setMore] = useState(false)
  const f = (k: keyof Profile) => ({ value: p[k] as string, onChange: (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value }) })
  const save = () => {
    if (!p.firstName.trim() || !p.surname.trim()) return toast('First name and surname are required', 'error')
    if (p.webPage && !/^https?:\/\//.test(p.webPage)) return toast('Web page must start with http:// or https://', 'error')
    update(p); toast('Changes saved')
  }
  return (
    <Shell title="Edit profile" onSave={save}>
      <h2 className="font-bold">General</h2>
      <Field label="First name *"><input className="form-control" {...f('firstName')} /></Field>
      <Field label="Surname *"><input className="form-control" {...f('surname')} /></Field>
      <Field label="Email address" help="Managed by the institution"><input className="form-control" value={user?.email ?? ''} disabled /></Field>
      <Field label="Email display">
        <select className="form-control" value={p.emailDisplay} onChange={(e) => setP({ ...p, emailDisplay: e.target.value as Profile['emailDisplay'] })}>
          <option value="hide">Hide my email address from non-privileged users</option><option value="everyone">Allow everyone to see my email address</option><option value="courses">Allow only other course members to see my email address</option>
        </select>
      </Field>
      <Field label="City/town"><input className="form-control" {...f('city')} /></Field>
      <Field label="Country"><select className="form-control" {...f('country')}>{['Sri Lanka', 'India', 'United Kingdom', 'Australia', 'United States', 'Maldives', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Timezone"><select className="form-control" {...f('timezone')}>{['Asia/Colombo', 'Asia/Kolkata', 'Europe/London', 'Australia/Sydney', 'UTC'].map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Description"><textarea rows={4} className="form-control" {...f('description')} placeholder="Tell others a little about yourself" /></Field>
      <button className="btn btn-ghost btn-sm" onClick={() => setMore(!more)}>{more ? 'Hide' : 'Show'} additional names, interests and optional fields</button>
      {more && <>
        <h2 className="font-bold pt-2">Additional names</h2>
        <Field label="Middle name"><input className="form-control" {...f('middleName')} /></Field>
        <Field label="Alternate name"><input className="form-control" {...f('alternateName')} /></Field>
        <h2 className="font-bold pt-2">Interests</h2>
        <Field label="List of interests" help="Separate with commas"><input className="form-control" {...f('interests')} placeholder="e.g. Machine learning, Football" /></Field>
        <h2 className="font-bold pt-2">Optional</h2>
        <Field label="Web page"><input className="form-control" {...f('webPage')} placeholder="https://" /></Field>
        <Field label="ID number"><input className="form-control" {...f('idNumber')} /></Field>
        <Field label="Institution"><input className="form-control" {...f('institution')} /></Field>
        <Field label="Department"><input className="form-control" {...f('department')} /></Field>
        <Field label="Phone"><input className="form-control" {...f('phone')} /></Field>
        <Field label="Mobile phone"><input className="form-control" {...f('mobile')} /></Field>
        <Field label="Address"><input className="form-control" {...f('address')} /></Field>
      </>}
    </Shell>
  )
}

function PasswordForm() {
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [again, setAgain] = useState('')
  const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const rules = [
    { ok: nw.length >= 8, t: 'At least 8 characters' },
    { ok: /\d/.test(nw), t: 'At least 1 digit' },
    { ok: /[a-z]/.test(nw), t: 'At least 1 lower case letter' },
    { ok: /[A-Z]/.test(nw), t: 'At least 1 upper case letter' },
    { ok: /[^A-Za-z0-9]/.test(nw), t: 'At least 1 special character such as *, -, or #' },
  ]
  const save = async () => {
    setErr('')
    if (!cur) return setErr('Current password is required')
    if (rules.some((r) => !r.ok)) return setErr('The new password does not meet the password policy')
    if (nw !== again) return setErr('The passwords do not match')
    if (nw === cur) return setErr('The new password must be different from the current password')
    setBusy(true)
    try {
      await api.post('/api/auth/change-password', { currentPassword: cur, newPassword: nw })
      setCur(''); setNw(''); setAgain(''); toast('Password has been changed')
    } catch (e) {
      setErr(isAxiosError(e) && e.response ? (e.response.data?.error ?? 'Invalid current password') : 'Unable to connect to the server. Please try again.')
    } finally { setBusy(false) }
  }
  const input = (v: string, set: (s: string) => void, label: string, ac: string) => (
    <Field label={label}><div className="relative"><input type={show ? 'text' : 'password'} autoComplete={ac} className="form-control pr-11" value={v} onChange={(e) => set(e.target.value)} /><button type="button" className="absolute right-1 top-1/2 -translate-y-1/2 icon-btn !w-8 !h-8" onClick={() => setShow(!show)} aria-label="Show passwords">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></Field>
  )
  return (
    <Shell title="Change password">
      {input(cur, setCur, 'Current password', 'current-password')}
      {input(nw, setNw, 'New password', 'new-password')}
      {input(again, setAgain, 'New password (again)', 'new-password')}
      <div className="grid md:grid-cols-[220px_1fr] gap-6"><div /><ul className="space-y-1 text-sm">{rules.map((r) => <li key={r.t} style={{ color: r.ok ? 'var(--color-green)' : 'var(--color-text-muted)' }}>{r.ok ? '✓' : '•'} {r.t}</li>)}</ul></div>
      {err && <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'var(--color-red-soft)', color: 'var(--color-red)' }}><AlertTriangle size={16} className="mt-0.5 shrink-0" />{err}</div>}
      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy} onClick={save}><Save size={16} /> Save changes</button></div>
    </Shell>
  )
}

function NotificationPrefs() {
  const st = usePrefsStore()
  return (
    <div className="space-y-6 max-w-5xl">
      <nav className="text-sm muted flex gap-1.5"><Link to="/preferences" className="muted hover:underline">Preferences</Link><span>/</span><span style={{ color: 'var(--color-heading)' }}>Notification preferences</span></nav>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold mr-auto">Notification preferences</h1>
        <label className="flex items-center gap-3 cursor-pointer"><span className="text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>Disable notifications</span><Toggle on={st.notifDisabled} onChange={(v) => st.set('notifDisabled', v)} label="Disable notifications" /></label>
      </div>
      <div className={`card overflow-x-auto ${st.notifDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
              <th className="text-left px-5 py-3" rowSpan={2}>Notification</th><th className="px-3 py-2" colSpan={2}>Web</th><th className="px-3 py-2" colSpan={2}>Email</th>
            </tr>
            <tr className="text-[11px] muted" style={{ background: 'var(--color-bg-subtle)' }}>
              <th className="px-3 pb-2 font-medium">Logged in</th><th className="px-3 pb-2 font-medium">Not logged in</th><th className="px-3 pb-2 font-medium">Logged in</th><th className="px-3 pb-2 font-medium">Not logged in</th>
            </tr>
          </thead>
          <tbody>
            {NOTIF_COMPONENTS.map((g) => (
              <Fragment key={g.group}>
                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}><td colSpan={5} className="px-5 py-2.5 font-bold" style={{ color: 'var(--color-heading)' }}>{g.group}</td></tr>
                {g.items.map((it) => {
                  const v = st.notif[it] ?? notifDefault
                  return (
                    <tr key={it} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-5 py-3 pl-9">{it}</td>
                      {(['webIn', 'webOut', 'emailIn', 'emailOut'] as const).map((k) => <td key={k} className="px-3 py-3 text-center"><Toggle on={v[k]} onChange={(x) => st.setNotif(it, { [k]: x })} label={`${it} ${k}`} /></td>)}
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs muted">Changes are saved automatically.</p>
    </div>
  )
}

export function PreferencesSection() {
  const { section } = useParams()
  const st = usePrefsStore()
  const social = useSocialStore()
  const setTheme = useThemeStore((s) => s.setTheme)
  const theme = useThemeStore((s) => s.theme)
  const label = ALL.find((s) => s.slug === section)?.label
  if (!label) return <Navigate to="/preferences" replace />
  const saved = () => toast('Changes saved')

  switch (section) {
    case 'profile': return <ProfileForm />
    case 'password': return <PasswordForm />
    case 'notifications': return <NotificationPrefs />
    case 'language': return (
      <Shell title={label} onSave={saved}>
        <Field label="Preferred language"><select className="form-control" value={st.language} onChange={(e) => st.set('language', e.target.value)}><option>English (en)</option><option>සිංහල (si)</option><option>தமிழ் (ta)</option></select></Field>
        <Field label="Theme" help="Applies to this browser"><select className="form-control" value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}><option value="light">Light</option><option value="dark">Dark</option></select></Field>
      </Shell>
    )
    case 'forum': return (
      <Shell title={label} onSave={saved}>
        <Field label="Email digest type"><select className="form-control" value={st.forum.digest} onChange={(e) => st.set('forum', { ...st.forum, digest: e.target.value as typeof st.forum.digest })}><option value="none">No digest (single email per forum post)</option><option value="complete">Complete (daily email with full posts)</option><option value="subjects">Subjects (daily email with subjects only)</option></select></Field>
        <Field label="Forum auto-subscribe"><select className="form-control" value={String(st.forum.autoSubscribe)} onChange={(e) => st.set('forum', { ...st.forum, autoSubscribe: e.target.value === 'true' })}><option value="true">Yes: when I post, subscribe me to that forum discussion</option><option value="false">No: don't automatically subscribe me to forum discussions</option></select></Field>
        <Field label="Use experimental nested discussion view"><select className="form-control" value={String(st.forum.nested)} onChange={(e) => st.set('forum', { ...st.forum, nested: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></Field>
        <Field label="Forum tracking"><select className="form-control" value={String(st.forum.tracking)} onChange={(e) => st.set('forum', { ...st.forum, tracking: e.target.value === 'true' })}><option value="false">No: don't keep track of posts I have seen</option><option value="true">Yes: highlight new posts for me</option></select></Field>
        <Field label="When sending forum post notifications"><select className="form-control" value={String(st.forum.markRead)} onChange={(e) => st.set('forum', { ...st.forum, markRead: e.target.value === 'true' })}><option value="true">Mark the post as read</option><option value="false">Do not mark the post as read</option></select></Field>
      </Shell>
    )
    case 'editor': return (
      <Shell title={label} onSave={saved}>
        <Field label="Text editor"><select className="form-control" value={st.editor} onChange={(e) => st.set('editor', e.target.value as typeof st.editor)}><option value="default">Default editor</option><option value="tinymce">TinyMCE HTML editor</option><option value="atto">Atto HTML editor</option><option value="plain">Plain text area</option></select></Field>
      </Shell>
    )
    case 'course': return (
      <Shell title={label} onSave={saved}>
        <label className="flex items-center justify-between gap-4"><span><span className="form-label !mb-0">Enable activity chooser</span><span className="text-xs muted block">Show the activity chooser when adding activities to a course</span></span><Toggle on={st.activityChooser} onChange={(v) => st.set('activityChooser', v)} label="Activity chooser" /></label>
      </Shell>
    )
    case 'calendar': return (
      <Shell title={label} onSave={saved}>
        <Field label="Time display format"><select className="form-control" value={st.calendar.timeFormat} onChange={(e) => st.set('calendar', { ...st.calendar, timeFormat: e.target.value as typeof st.calendar.timeFormat })}><option value="default">Default</option><option value="12">12-hour (am/pm)</option><option value="24">24-hour</option></select></Field>
        <Field label="First day of week"><select className="form-control" value={st.calendar.firstDay} onChange={(e) => st.set('calendar', { ...st.calendar, firstDay: Number(e.target.value) })}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
        <Field label="Maximum upcoming events"><select className="form-control" value={st.calendar.maxUpcoming} onChange={(e) => st.set('calendar', { ...st.calendar, maxUpcoming: Number(e.target.value) })}>{[1, 2, 3, 5, 10, 15, 20].map((n) => <option key={n}>{n}</option>)}</select></Field>
        <Field label="Upcoming events look-ahead"><select className="form-control" value={st.calendar.lookaheadDays} onChange={(e) => st.set('calendar', { ...st.calendar, lookaheadDays: Number(e.target.value) })}>{[[1, '1 day'], [7, '1 week'], [14, '2 weeks'], [21, '3 weeks'], [30, '1 month'], [90, '3 months'], [365, '1 year']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Remember filter settings"><select className="form-control" value={String(st.calendar.rememberFilter)} onChange={(e) => st.set('calendar', { ...st.calendar, rememberFilter: e.target.value === 'true' })}><option value="false">No</option><option value="true">Yes</option></select></Field>
      </Shell>
    )
    case 'messages': return (
      <Shell title={label}>
        <h2 className="font-bold">Privacy</h2>
        <p className="text-sm muted -mt-3">You can restrict who can message you</p>
        {([['contacts', 'My contacts only'], ['courses', 'My contacts and anyone in my courses']] as const).map(([v, l]) => (
          <label key={v} className="flex items-center gap-3 cursor-pointer text-sm" style={{ color: 'var(--color-heading)' }}><input type="radio" checked={social.privacy === v} onChange={() => { social.setPrivacy(v); saved() }} className="accent-[var(--color-primary)]" />{l}</label>
        ))}
        <h2 className="font-bold pt-2">General</h2>
        <label className="flex items-center justify-between"><span className="text-sm" style={{ color: 'var(--color-heading)' }}>Use enter to send</span><Toggle on={social.enterToSend} onChange={(v) => social.setEnterToSend(v)} label="Use enter to send" /></label>
      </Shell>
    )
    case 'badges': return (
      <Shell title={label} onSave={saved}>
        <label className="flex items-center justify-between gap-4"><span><span className="form-label !mb-0">Automatically show badges I earn on my profile page</span></span><Toggle on={st.badges.showOnProfile} onChange={(v) => st.set('badges', { showOnProfile: v })} label="Show badges on profile" /></label>
        <Link to="/badges" className="text-sm font-semibold">Manage badges</Link>
      </Shell>
    )
  }
  return null
}
