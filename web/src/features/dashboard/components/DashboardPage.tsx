import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, LayoutGrid, List, AlignJustify, Search, BookOpen, CalendarClock, AlertTriangle, TrendingUp, ClipboardCheck, Clock, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, LayoutTemplate, PanelRight, Award } from 'lucide-react'
import { usePrefsStore, BLOCK_LABELS, BADGES, type BlockId } from '../../../store/prefsStore'
import { useCalendarEvents, EVENT_COLORS } from '../../calendar/useCalendarEvents'
import { toast } from '../../../components/Toast'
import { useLmsStore, courseProgress, assignPhase, CURRENT_STUDENT_ID, STUDENTS, type Course } from '../../../store/lmsStore'
import { useAuthStore } from '../../../store/authStore'
import { useRole } from '../../../store/uiStore'
import { fmtDay, fmtTime } from '../../../lib/format'
import { CourseBanner, CourseCard, CourseMenu } from './CourseCard'
import { MiniCalendar } from '../../calendar/components/MiniCalendar'

type Filter = 'all' | 'inprogress' | 'future' | 'past' | 'starred' | 'removed'
type Sort = 'name' | 'access'
type View = 'card' | 'list' | 'summary'
type TlFilter = 'all' | 'overdue' | '7' | '30' | '90' | '180'

const FILTERS: Record<Filter, string> = { all: 'All (except removed from view)', inprogress: 'In progress', future: 'Future', past: 'Past', starred: 'Starred', removed: 'Removed from view' }
const TL_FILTERS: Record<TlFilter, string> = { all: 'All', overdue: 'Overdue', '7': 'Next 7 days', '30': 'Next 30 days', '90': 'Next 3 months', '180': 'Next 6 months' }

const isPast = (c: Course) => c.term.startsWith('Year 3')

function Stat({ icon: Icon, label, value, tone }: { icon: typeof BookOpen; label: string; value: string | number; tone: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className="w-12 h-12 rounded-2xl grid place-items-center" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Icon size={22} /></span>
      <div>
        <div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{value}</div>
        <div className="text-xs font-medium muted">{label}</div>
      </div>
    </div>
  )
}

function Select<T extends string>({ value, onChange, options, className = '!w-auto' }: { value: T; onChange: (v: T) => void; options: Record<T, string>; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`form-control !h-9 pr-8 text-sm font-medium cursor-pointer ${className}`}>
      {(Object.keys(options) as T[]).map((k) => <option key={k} value={k}>{options[k]}</option>)}
    </select>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { isTeacher } = useRole()
  const courses = useLmsStore((s) => s.courses)
  const completion = useLmsStore((s) => s.completion)
  const submissions = useLmsStore((s) => s.submissions)

  const [filter, setFilter] = useState<Filter>('inprogress')
  const [sort, setSort] = useState<Sort>('name')
  const [view, setView] = useState<View>('card')
  const [search, setSearch] = useState('')
  const [tlFilter, setTlFilter] = useState<TlFilter>('7')
  const [customising, setCustomising] = useState(false)
  const { blockOrder, hiddenBlocks, hideBlocks, moveBlock, toggleBlockHidden, resetDashboard, set: setPref } = usePrefsStore()
  const [tlSort, setTlSort] = useState<'dates' | 'courses'>('dates')
  const scroller = useRef<HTMLDivElement>(null)

  const recent = [...courses].filter((c) => !c.hidden).sort((a, b) => b.lastAccess.localeCompare(a.lastAccess)).slice(0, 6)

  const overview = useMemo(() => {
    let list = courses.filter((c) => {
      if (filter === 'removed') return c.hidden
      if (c.hidden) return false
      if (filter === 'inprogress') return !isPast(c)
      if (filter === 'past') return isPast(c)
      if (filter === 'future') return false
      if (filter === 'starred') return c.starred
      return true
    })
    const t = search.trim().toLowerCase()
    if (t) list = list.filter((c) => `${c.shortName} ${c.fullName}`.toLowerCase().includes(t))
    return list.sort((a, b) => (sort === 'name' ? a.fullName.localeCompare(b.fullName) : b.lastAccess.localeCompare(a.lastAccess)))
  }, [courses, filter, sort, search])

  const timeline = useMemo(() => {
    const now = new Date()
    const items: { id: number; course: Course; name: string; due: string; overdue: boolean; action: string }[] = []
    courses.forEach((c) => {
      if (c.hidden || isPast(c)) return
      c.sections.forEach((s) => s.activities.forEach((a) => {
        if (a.type !== 'assign' || !a.visible || !a.assign?.dueDate) return
        const phase = assignPhase(a.assign, now)
        if (phase === 'closed' || phase === 'disabled') return
        if (isTeacher) {
          const pending = STUDENTS.filter((st) => { const sb = submissions[`${a.id}:${st.id}`]; return sb?.status === 'submitted' && sb.grade === null }).length
          if (!pending) return
          items.push({ id: a.id, course: c, name: a.name, due: a.assign.dueDate, overdue: false, action: `Grade (${pending})` })
          return
        }
        if (submissions[`${a.id}:${CURRENT_STUDENT_ID}`]?.status === 'submitted') return
        items.push({ id: a.id, course: c, name: a.name, due: a.assign.dueDate, overdue: phase === 'overdue', action: 'Add submission' })
      }))
    })
    const filtered = items.filter((i) => {
      if (tlFilter === 'overdue') return i.overdue
      if (tlFilter === 'all') return true
      return i.overdue || new Date(i.due).getTime() - now.getTime() <= Number(tlFilter) * 86_400_000
    })
    return filtered.sort((a, b) => (tlSort === 'dates' ? a.due.localeCompare(b.due) : a.course.fullName.localeCompare(b.course.fullName) || a.due.localeCompare(b.due)))
  }, [courses, submissions, tlFilter, tlSort, isTeacher])

  const active = courses.filter((c) => !c.hidden && !isPast(c))
  const avg = active.length ? Math.round(active.reduce((n, c) => n + courseProgress(c, completion), 0) / active.length) : 0
  const dueWeek = timeline.filter((i) => !i.overdue && new Date(i.due).getTime() - Date.now() < 7 * 86_400_000).length
  const overdue = timeline.filter((i) => i.overdue).length
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const grouped = useMemo(() => {
    const m = new Map<string, typeof timeline>()
    timeline.forEach((i) => {
      const k = tlSort === 'dates' ? (i.overdue ? 'Overdue' : fmtDay(i.due)) : `${i.course.shortName}-${i.course.fullName}`
      m.set(k, [...(m.get(k) ?? []), i])
    })
    return [...m.entries()]
  }, [timeline, tlSort])

  const renderBlocks = (map: Record<BlockId, ReactNode>) =>
    blockOrder.filter((id) => customising || !hiddenBlocks.includes(id)).map((id, i, arr) => (
      <div key={id} className={`relative ${customising ? 'rounded-2xl outline-2 outline-dashed outline-offset-4 outline-[var(--color-primary)]' : ''} ${hiddenBlocks.includes(id) ? 'opacity-40' : ''}`}>
        {customising && (
          <div className="absolute -top-3 right-3 z-10 flex gap-1 p-1 rounded-xl card">
            <button className="icon-btn !w-7 !h-7" disabled={i === 0} onClick={() => moveBlock(id, -1)} title="Move up"><ArrowUp size={14} /></button>
            <button className="icon-btn !w-7 !h-7" disabled={i === arr.length - 1} onClick={() => moveBlock(id, 1)} title="Move down"><ArrowDown size={14} /></button>
            <button className="icon-btn !w-7 !h-7" onClick={() => toggleBlockHidden(id)} title={hiddenBlocks.includes(id) ? `Show ${BLOCK_LABELS[id]} block` : `Hide ${BLOCK_LABELS[id]} block`}>{hiddenBlocks.includes(id) ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          </div>
        )}
        {map[id]}
      </div>
    ))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-end gap-2 -mb-4">
        {customising && <button className="btn btn-ghost btn-sm" onClick={() => { resetDashboard(); toast('Dashboard reset to default') }}><RotateCcw size={14} /> Reset page to default</button>}
        <button className={`btn btn-sm ${customising ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCustomising(!customising)}><LayoutTemplate size={14} /> {customising ? 'Stop customising this page' : 'Customise this page'}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setPref('hideBlocks', !hideBlocks)}><PanelRight size={14} /> {hideBlocks ? 'Show blocks' : 'Hide blocks'}</button>
      </div>
      <div className="relative overflow-hidden rounded-3xl p-7 lg:p-9 text-white" style={{ background: 'linear-gradient(120deg,#00267A 0%,#0033A0 55%,#00B3A1 130%)' }}>
        <div className="absolute -right-10 -top-16 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute right-40 -bottom-24 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative">
          <div className="text-sm font-medium text-white/80">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="!text-white text-2xl lg:text-3xl font-bold mt-1">{greet}, {user?.fullName?.split(' ')[0] ?? 'there'} 👋</h1>
          <p className="text-white/80 mt-2 max-w-xl">
            {isTeacher ? `You have ${timeline.length} assignment${timeline.length === 1 ? '' : 's'} waiting for grading.` : `You have ${dueWeek} activit${dueWeek === 1 ? 'y' : 'ies'} due this week${overdue ? ` and ${overdue} overdue` : ''}. Keep it up!`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={BookOpen} label="Courses in progress" value={active.length} tone="#0033A0" />
        <Stat icon={isTeacher ? ClipboardCheck : CalendarClock} label={isTeacher ? 'To grade' : 'Due in 7 days'} value={isTeacher ? timeline.length : dueWeek} tone="#0D9488" />
        <Stat icon={AlertTriangle} label="Overdue" value={overdue} tone="#DC2626" />
        <Stat icon={TrendingUp} label="Average progress" value={`${avg}%`} tone="#7C3AED" />
      </div>

      <div className={`grid gap-8 ${hideBlocks ? '' : 'xl:grid-cols-[minmax(0,1fr)_360px]'}`}>
        <div className="space-y-8 min-w-0">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Recently accessed courses</h2>
              <div className="flex gap-1">
                <button className="icon-btn !w-9 !h-9 card" onClick={() => scroller.current?.scrollBy({ left: -320, behavior: 'smooth' })} aria-label="Previous"><ChevronLeft size={18} /></button>
                <button className="icon-btn !w-9 !h-9 card" onClick={() => scroller.current?.scrollBy({ left: 320, behavior: 'smooth' })} aria-label="Next"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div ref={scroller} className="flex gap-4 overflow-x-auto snap-x pb-2 -mx-1 px-1 [scrollbar-width:none]">
              {recent.map((c) => (
                <Link key={c.id} to={`/courses/${c.id}`} className="card overflow-hidden shrink-0 w-[260px] snap-start hover:-translate-y-0.5 transition-transform !text-inherit">
                  <CourseBanner course={c} className="h-24" />
                  <div className="p-4">
                    <div className="text-xs muted mb-1">{c.term}</div>
                    <div className="font-semibold text-sm line-clamp-2" style={{ color: 'var(--color-heading)' }}>{c.shortName}-{c.fullName}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-lg font-bold mr-auto">Course overview</h2>
              <Select value={filter} onChange={setFilter} options={FILTERS} />
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="form-control !h-9 pl-9 !w-44" />
              </div>
              <Select value={sort} onChange={setSort} options={{ name: 'Sort by course name', access: 'Sort by last accessed' }} />
              <div className="flex p-1 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
                {([['card', LayoutGrid], ['list', List], ['summary', AlignJustify]] as const).map(([v, Icon]) => (
                  <button key={v} onClick={() => setView(v)} title={v[0].toUpperCase() + v.slice(1)}
                    className={`w-8 h-7 rounded-lg grid place-items-center ${view === v ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'muted'}`}>
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>

            {overview.length === 0 ? (
              <div className="card p-12 text-center">
                <BookOpen size={36} className="mx-auto muted" />
                <div className="mt-3 font-semibold" style={{ color: 'var(--color-heading)' }}>No courses</div>
                <div className="text-sm muted">There are no courses matching “{FILTERS[filter]}”.</div>
              </div>
            ) : view === 'card' ? (
              <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-5">{overview.map((c) => <CourseCard key={c.id} course={c} />)}</div>
            ) : (
              <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {overview.map((c) => {
                  const p = courseProgress(c, completion)
                  return (
                    <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-[var(--color-bg-card-hover)] first:rounded-t-2xl last:rounded-b-2xl" style={{ borderColor: 'var(--color-border)' }}>
                      <CourseBanner course={c} className={`${view === 'summary' ? 'w-24 h-24' : 'w-14 h-14'} rounded-xl shrink-0`} />
                      <Link to={`/courses/${c.id}`} className="flex-1 min-w-0 !text-inherit">
                        <div className="text-xs muted">{c.term} · {c.category}</div>
                        <div className="font-semibold truncate" style={{ color: 'var(--color-heading)' }}>{c.shortName}-{c.fullName}</div>
                        {view === 'summary' && <p className="text-sm muted mt-1 line-clamp-2">Lecturer: {c.lecturer}. This module covers the core concepts of {c.fullName.toLowerCase()} with lectures, tutorials and a graded assignment.</p>}
                      </Link>
                      <div className="w-36 hidden sm:block">
                        <div className="text-xs text-right mb-1 font-semibold" style={{ color: 'var(--color-heading)' }}>{p}% complete</div>
                        <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${p}%` }} /></div>
                      </div>
                      <CourseMenu course={c} />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {!hideBlocks && <aside className="space-y-6">{renderBlocks({
          timeline: <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2"><Clock size={18} style={{ color: 'var(--color-primary)' }} /> Timeline</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Select value={tlFilter} onChange={setTlFilter} options={TL_FILTERS} className="min-w-0" />
              <Select value={tlSort} onChange={setTlSort} options={{ dates: 'Sort by dates', courses: 'Sort by courses' }} className="min-w-0" />
            </div>
            {grouped.length === 0 ? (
              <div className="text-center py-8">
                <CalendarClock size={32} className="mx-auto muted" />
                <div className="text-sm muted mt-2">No activities require action</div>
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map(([day, items]) => (
                  <div key={day}>
                    <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${day === 'Overdue' ? '' : 'muted'}`} style={day === 'Overdue' ? { color: 'var(--color-red)' } : {}}>{day}</div>
                    <div className="space-y-2">
                      {items.map((i) => (
                        <div key={i.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
                          <span className="text-xs font-semibold mt-0.5 w-14 shrink-0" style={{ color: i.overdue ? 'var(--color-red)' : 'var(--color-heading)' }}>{fmtTime(i.due)}</span>
                          <div className="flex-1 min-w-0">
                            <Link to={`/courses/${i.course.id}/assign/${i.id}`} className="font-medium text-sm block truncate" style={{ color: 'var(--color-heading)' }}>{i.name}</Link>
                            <div className="text-xs muted truncate">Assignment is due · {i.course.shortName}</div>
                            <Link to={`/courses/${i.course.id}/assign/${i.id}`} className="btn btn-secondary btn-sm mt-2">{i.action}</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>,
          calendar: <MiniCalendar />,
          upcoming: <UpcomingBlock />,
          badges: <BadgesBlock />,
          privatefiles: <section className="card p-5"><h2 className="font-bold mb-2">Private files</h2><p className="text-sm muted mb-3">No files available</p><Link to="/files" className="text-sm font-semibold">Manage private files…</Link></section>,
          onlineusers: <section className="card p-5">
            <h2 className="font-bold mb-1">Online users</h2>
            <div className="text-xs muted mb-3">{STUDENTS.length - 1} online users (last 5 minutes)</div>
            <div className="space-y-2.5">
              {STUDENTS.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 text-sm">
                  <span className="relative w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-heading)' }}>
                    {s.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                    <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: 'var(--color-green)', borderColor: 'var(--color-bg-card)' }} />
                  </span>
                  <span style={{ color: 'var(--color-heading)' }}>{s.name}</span>
                </div>
              ))}
            </div>
          </section>,
        })}</aside>}
      </div>
    </div>
  )
}

function UpcomingBlock() {
  const events = useCalendarEvents()
  const { maxUpcoming, lookaheadDays } = usePrefsStore((s) => s.calendar)
  const now = Date.now()
  const list = events.filter((e) => { const t = new Date(e.date).getTime(); return t >= now && t <= now + lookaheadDays * 86_400_000 }).slice(0, maxUpcoming)
  return (
    <section className="card p-5">
      <h2 className="font-bold mb-3">Upcoming events</h2>
      {list.length === 0 ? <p className="text-sm muted">There are no upcoming events</p> : (
        <div className="space-y-3">
          {list.map((e) => (
            <div key={e.key} className="flex gap-3">
              <span className="w-1 rounded-full shrink-0" style={{ background: EVENT_COLORS[e.type] }} />
              <div className="min-w-0">
                {e.link ? <Link to={e.link} className="text-sm font-medium block truncate" style={{ color: 'var(--color-heading)' }}>{e.title}</Link> : <div className="text-sm font-medium truncate" style={{ color: 'var(--color-heading)' }}>{e.title}</div>}
                <div className="text-xs muted">{fmtDay(e.date)}, {fmtTime(e.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-4 mt-4 text-sm font-semibold"><Link to="/calendar?view=upcoming">Go to calendar…</Link><Link to="/calendar" state={{ newEvent: true }}>New event…</Link></div>
    </section>
  )
}

function BadgesBlock() {
  return (
    <section className="card p-5">
      <h2 className="font-bold mb-3">Latest badges</h2>
      <div className="space-y-2.5">
        {BADGES.slice(0, 3).map((b) => (
          <Link key={b.id} to="/badges" className="flex items-center gap-3 !text-inherit">
            <span className="w-9 h-9 rounded-full grid place-items-center text-white shrink-0" style={{ background: b.color }}><Award size={17} /></span>
            <span className="min-w-0"><span className="block text-sm font-medium truncate" style={{ color: 'var(--color-heading)' }}>{b.name}</span><span className="block text-xs muted">{b.issued}</span></span>
          </Link>
        ))}
      </div>
    </section>
  )
}
