import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, List, CalendarRange } from 'lucide-react'
import { usePrefsStore } from '../../../store/prefsStore'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useLmsStore, type LmsEvent } from '../../../store/lmsStore'
import { useRole } from '../../../store/uiStore'
import { Modal } from '../../../components/Modal'
import { toast } from '../../../components/Toast'
import { fromLocalInput, fmtDate, fmtDay, fmtTime, toLocalInput } from '../../../lib/format'
import { useCalendarEvents, EVENT_COLORS, EVENT_LABELS, type CalItem } from '../useCalendarEvents'

export default function CalendarPage() {
  const [params] = useSearchParams()
  const initialDay = params.get('day')
  const [month, setMonth] = useState(initialDay ? new Date(initialDay) : new Date())
  const [selected, setSelected] = useState<Date | null>(initialDay ? new Date(initialDay) : null)
  const [mode, setMode] = useState<'month' | 'day' | 'upcoming'>((params.get('view') as 'day' | 'upcoming') ?? (initialDay ? 'day' : 'month'))
  const location = useLocation()
  const calPrefs = usePrefsStore((s) => s.calendar)
  const weekStartsOn = calPrefs.firstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekDays = [...DAY_NAMES.slice(weekStartsOn), ...DAY_NAMES.slice(0, weekStartsOn)]
  const timeFmt = (iso: string) => format(new Date(iso), calPrefs.timeFormat === '24' ? 'HH:mm' : 'h:mm a')
  const [courseFilter, setCourseFilter] = useState<number | 0>(0)
  const [detail, setDetail] = useState<CalItem | null>(null)
  const [creating, setCreating] = useState(false)

  const courses = useLmsStore((s) => s.courses)
  const addEvent = useLmsStore((s) => s.addEvent)
  const deleteEvent = useLmsStore((s) => s.deleteEvent)
  const { isTeacher } = useRole()
  const all = useCalendarEvents()
  const events = useMemo(() => (courseFilter ? all.filter((e) => e.courseId === courseFilter || e.type === 'site') : all), [all, courseFilter])

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn }), end: endOfWeek(endOfMonth(month), { weekStartsOn }) })
  const upcoming = events.filter((e) => new Date(e.date) >= new Date() && new Date(e.date) <= addDays(new Date(), calPrefs.lookaheadDays)).slice(0, Math.max(calPrefs.maxUpcoming, 10))
  const dayDate = selected ?? new Date()
  const dayEvents = events.filter((e) => isSameDay(new Date(e.date), dayDate))
  useEffect(() => { if ((location.state as { newEvent?: boolean } | null)?.newEvent) openNew() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState({ title: '', date: toLocalInput(new Date().toISOString()), type: 'user' as LmsEvent['type'], courseId: 0, description: '' })
  const openNew = (day?: Date) => {
    const t = day ? new Date(day) : new Date()
    if (day) t.setHours(9, 0, 0, 0)
    setForm({ title: '', date: toLocalInput(t.toISOString()), type: 'user', courseId: 0, description: '' })
    setCreating(true)
  }
  const save = () => {
    if (!form.title.trim()) return toast('Event title is required', 'error')
    if (form.type === 'course' && !form.courseId) return toast('Select a course for a course event', 'error')
    addEvent({ title: form.title.trim(), date: fromLocalInput(form.date)!, type: form.type, courseId: form.courseId || undefined })
    setCreating(false)
    toast('Event saved')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm muted">Due dates, course and personal events.</p>
        </div>
        <select className="form-control !w-auto" value={courseFilter} onChange={(e) => setCourseFilter(Number(e.target.value))}>
          <option value={0}>All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.shortName}-{c.fullName}</option>)}
        </select>
        <div className="flex p-1 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
          {([['month', CalendarDays, 'Month'], ['day', CalendarRange, 'Day'], ['upcoming', List, 'Upcoming events']] as const).map(([m, Icon, l]) => (
            <button key={m} onClick={() => setMode(m)} className={`h-8 px-3 rounded-lg flex items-center gap-1.5 text-sm font-medium ${mode === m ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'muted'}`}><Icon size={15} />{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => openNew(selected ?? undefined)}><Plus size={17} /> New event</button>
      </div>

      {mode === 'day' ? (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <button className="icon-btn !w-9 !h-9" onClick={() => setSelected(addDays(dayDate, -1))} aria-label="Previous day"><ChevronLeft size={18} /></button>
            <h2 className="text-lg font-bold min-w-[260px] text-center">{format(dayDate, 'EEEE, d MMMM yyyy')}</h2>
            <button className="icon-btn !w-9 !h-9" onClick={() => setSelected(addDays(dayDate, 1))} aria-label="Next day"><ChevronRight size={18} /></button>
            <button className="btn btn-secondary btn-sm ml-2" onClick={() => setSelected(new Date())}>Today</button>
            <button className="btn btn-primary btn-sm ml-auto" onClick={() => openNew(dayDate)}><Plus size={15} /> New event</button>
          </div>
          {dayEvents.length === 0 ? <div className="p-12 text-center muted">There are no events on this day</div> : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {dayEvents.map((e) => (
                <button key={e.key} onClick={() => setDetail(e)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="w-20 text-sm font-semibold shrink-0" style={{ color: 'var(--color-heading)' }}>{timeFmt(e.date)}</span>
                  <span className="w-1 self-stretch rounded-full" style={{ background: EVENT_COLORS[e.type] }} />
                  <span className="flex-1 min-w-0"><span className="block font-semibold truncate" style={{ color: 'var(--color-heading)' }}>{e.title}</span><span className="block text-sm muted truncate">{EVENT_LABELS[e.type]}{e.courseName ? ` · ${e.courseName}` : ''}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : mode === 'month' ? (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <button className="icon-btn !w-9 !h-9" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <h2 className="text-lg font-bold w-44 text-center">{format(month, 'MMMM yyyy')}</h2>
            <button className="icon-btn !w-9 !h-9" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
            <button className="btn btn-secondary btn-sm ml-2" onClick={() => { setMonth(new Date()); setSelected(new Date()) }}>Today</button>
            <div className="ml-auto hidden md:flex gap-4 text-xs">
              {(Object.keys(EVENT_COLORS) as CalItem['type'][]).map((t) => <span key={t} className="flex items-center gap-1.5 muted"><span className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_COLORS[t] }} />{EVENT_LABELS[t]}</span>)}
            </div>
          </div>
          <div className="grid grid-cols-7 text-xs font-semibold muted border-b" style={{ borderColor: 'var(--color-border)' }}>
            {weekDays.map((d) => <div key={d} className="px-3 py-2.5"><span className="hidden md:inline">{d}</span><span className="md:hidden">{d.slice(0, 3)}</span></div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const ev = events.filter((e) => isSameDay(new Date(e.date), d))
              const today = isSameDay(d, new Date())
              const sel = selected && isSameDay(d, selected)
              return (
                <div key={d.toISOString()} onClick={() => setSelected(d)} onDoubleClick={() => openNew(d)}
                  className={`group min-h-[118px] p-2 border-b border-r cursor-pointer transition-colors ${isSameMonth(d, month) ? '' : 'opacity-45'} ${sel ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-bg-card-hover)]'}`}
                  style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`w-7 h-7 grid place-items-center rounded-full text-sm ${today ? 'text-white font-bold' : 'font-medium'}`} style={{ background: today ? 'var(--color-primary)' : undefined, color: today ? '#fff' : 'var(--color-heading)' }}>{format(d, 'd')}</span>
                    <button className="opacity-0 group-hover:opacity-100 icon-btn !w-6 !h-6" onClick={(e) => { e.stopPropagation(); openNew(d) }} aria-label="New event on this day"><Plus size={14} /></button>
                  </div>
                  <div className="space-y-1">
                    {ev.slice(0, 3).map((e) => (
                      <button key={e.key} onClick={(x) => { x.stopPropagation(); setDetail(e) }} className="w-full text-left truncate text-[11px] font-medium px-1.5 py-1 rounded-md"
                        style={{ background: `color-mix(in srgb, ${EVENT_COLORS[e.type]} 13%, transparent)`, color: EVENT_COLORS[e.type] }}>
                        {e.title}
                      </button>
                    ))}
                    {ev.length > 3 && <div className="text-[11px] muted px-1">+{ev.length - 3} more</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {upcoming.length === 0 && <div className="p-12 text-center muted">There are no upcoming events</div>}
          {upcoming.map((e) => (
            <button key={e.key} onClick={() => setDetail(e)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}>
              <div className="w-14 text-center shrink-0">
                <div className="text-xs font-bold uppercase" style={{ color: EVENT_COLORS[e.type] }}>{format(new Date(e.date), 'MMM')}</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-heading)' }}>{format(new Date(e.date), 'd')}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate" style={{ color: 'var(--color-heading)' }}>{e.title}</div>
                <div className="text-sm muted truncate">{fmtDay(e.date)}, {fmtTime(e.date)}{e.courseName ? ` · ${e.courseName}` : ''}</div>
              </div>
              <span className="badge" style={{ background: `color-mix(in srgb, ${EVENT_COLORS[e.type]} 13%, transparent)`, color: EVENT_COLORS[e.type] }}>{EVENT_LABELS[e.type]}</span>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!detail} title={detail?.title ?? ''} onClose={() => setDetail(null)}
        footer={detail && (
          <>
            {detail.editable && <button className="btn btn-danger mr-auto" onClick={() => { deleteEvent(detail.id); setDetail(null); toast('Event deleted') }}><Trash2 size={16} /> Delete</button>}
            {detail.link && <Link to={detail.link} className="btn btn-primary !text-white">Go to activity</Link>}
            <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
          </>
        )}>
        {detail && (
          <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
            <dt className="muted">When</dt><dd style={{ color: 'var(--color-heading)' }}>{fmtDate(detail.date)}</dd>
            <dt className="muted">Event type</dt><dd><span className="badge" style={{ background: `color-mix(in srgb, ${EVENT_COLORS[detail.type]} 13%, transparent)`, color: EVENT_COLORS[detail.type] }}>{EVENT_LABELS[detail.type]}</span></dd>
            {detail.courseName && <><dt className="muted">Course</dt><dd style={{ color: 'var(--color-heading)' }}>{detail.courseName}</dd></>}
          </dl>
        )}
      </Modal>

      <Modal open={creating} title="New event" onClose={() => setCreating(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="space-y-4">
          <div><label className="form-label">Event title <span style={{ color: 'var(--color-red)' }}>*</span></label><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></div>
          <div><label className="form-label">Date</label><input type="datetime-local" className="form-control" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div>
            <label className="form-label">Type of event</label>
            <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LmsEvent['type'] })}>
              <option value="user">User</option>
              {isTeacher && <option value="course">Course</option>}
              {isTeacher && <option value="site">Site</option>}
            </select>
          </div>
          {form.type === 'course' && (
            <div><label className="form-label">Course</label>
              <select className="form-control" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: Number(e.target.value) })}>
                <option value={0}>Select a course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.shortName}-{c.fullName}</option>)}
              </select>
            </div>
          )}
          <div><label className="form-label">Description</label><textarea rows={3} className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  )
}
