import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useCalendarEvents, EVENT_COLORS } from '../useCalendarEvents'

export function MiniCalendar() {
  const [month, setMonth] = useState(new Date())
  const events = useCalendarEvents()
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <Link to="/calendar" className="font-bold" style={{ color: 'var(--color-heading)' }}>{format(month, 'MMMM yyyy')}</Link>
        <div className="flex">
          <button className="icon-btn !w-8 !h-8" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <button className="icon-btn !w-8 !h-8" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold muted mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
        {days.map((d) => {
          const ev = events.filter((e) => isSameDay(new Date(e.date), d))
          const today = isSameDay(d, new Date())
          return (
            <Link key={d.toISOString()} to={`/calendar?day=${format(d, 'yyyy-MM-dd')}`} title={ev.map((e) => e.title).join('\n')}
              className={`relative h-9 rounded-lg grid place-items-center ${isSameMonth(d, month) ? '' : 'opacity-35'} ${today ? 'font-bold text-white' : 'hover:bg-[var(--color-bg-subtle)]'}`}
              style={{ background: today ? 'var(--color-primary)' : undefined, color: today ? '#fff' : 'var(--color-heading)' }}>
              {format(d, 'd')}
              {ev.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {ev.slice(0, 3).map((e) => <span key={e.key} className="w-1 h-1 rounded-full" style={{ background: today ? '#fff' : EVENT_COLORS[e.type] }} />)}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
