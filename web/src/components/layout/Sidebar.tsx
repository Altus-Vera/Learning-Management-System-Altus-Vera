import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Home, CalendarDays, GraduationCap, BookOpen, Library, ScrollText, MessageSquareWarning, ChevronDown, FolderLock } from 'lucide-react'
import { useState } from 'react'
import { useLmsStore } from '../../store/lmsStore'
import { useUiStore } from '../../store/uiStore'

const MAIN = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/home', label: 'Site home', icon: Home },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/grades', label: 'Grades', icon: GraduationCap },
  { to: '/files', label: 'Private files', icon: FolderLock },
]

const RESOURCES = [
  { to: '/page/references', label: 'Online Reference Materials', icon: Library },
  { to: '/page/guidelines', label: 'Student Guidelines', icon: ScrollText },
  { to: '/page/feedback', label: 'Feedback & Complaints', icon: MessageSquareWarning },
]

export function Sidebar({ mobileOpen, onNavigate }: { mobileOpen: boolean; onNavigate: () => void }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const courses = useLmsStore((s) => s.courses)
  const [coursesOpen, setCoursesOpen] = useState(true)
  const { pathname } = useLocation()
  const inProgress = courses.filter((c) => !c.term.startsWith('Year 3'))

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3 h-10 text-sm font-medium transition-colors ${
      isActive ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-heading)]'
    }`

  const wide = !collapsed || mobileOpen

  return (
    <aside
      className={`fixed lg:sticky top-0 z-40 h-screen shrink-0 flex flex-col border-r transition-all duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${wide ? 'w-[268px]' : 'w-[76px]'}`}
      style={{ background: 'var(--color-bg-sidebar)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-3 h-16 px-5 shrink-0">
        <svg width="34" height="34" viewBox="0 0 40 40" className="shrink-0">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00B3A1" /><stop offset="1" stopColor="#2554C7" /></linearGradient></defs>
          <rect width="40" height="40" rx="11" fill="url(#lg)" />
          <path d="M20 9 L31 30 H9 Z" fill="#fff" opacity=".95" />
          <path d="M20 19 L25.5 30 H14.5 Z" fill="#2554C7" opacity=".55" />
        </svg>
        {wide && (
          <div className="leading-tight">
            <div className="font-extrabold text-[15px] tracking-tight" style={{ color: 'var(--color-heading)' }}>Altus Vera</div>
            <div className="text-[11px] font-medium muted">Learning Platform</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-6" onClick={onNavigate}>
        <div className="space-y-1">
          {MAIN.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls} title={label}>
              <Icon size={19} className="shrink-0" />
              {wide && label}
            </NavLink>
          ))}
        </div>

        <div>
          {wide ? (
            <button
              onClick={(e) => { e.stopPropagation(); setCoursesOpen((v) => !v) }}
              className="flex w-full items-center justify-between px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider muted"
            >
              My courses
              <ChevronDown size={14} className={`transition-transform ${coursesOpen ? '' : '-rotate-90'}`} />
            </button>
          ) : (
            <div className="mx-3 mb-2 border-t" style={{ borderColor: 'var(--color-border)' }} />
          )}
          {coursesOpen && (
            <div className="space-y-0.5">
              {inProgress.map((c) => (
                <NavLink
                  key={c.id}
                  to={`/courses/${c.id}`}
                  title={`${c.shortName} — ${c.fullName}`}
                  className={() =>
                    `flex items-center gap-3 rounded-xl px-3 h-10 text-sm transition-colors ${
                      pathname.includes(`/${c.id}`) ? 'bg-[var(--color-bg-subtle)] text-[var(--color-heading)] font-semibold' : 'text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]'
                    }`
                  }
                >
                  <span className="w-[19px] h-[19px] rounded-md shrink-0 grid place-items-center text-[9px] font-bold text-white" style={{ background: c.color }}>
                    {c.shortName.slice(0, 2)}
                  </span>
                  {wide && <span className="truncate">{c.shortName} · {c.fullName}</span>}
                </NavLink>
              ))}
              {wide && (
                <NavLink to="/courses" className="flex items-center gap-3 px-3 h-9 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                  <BookOpen size={17} /> All courses
                </NavLink>
              )}
            </div>
          )}
        </div>

        <div>
          {wide && <div className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider muted">Resources</div>}
          <div className="space-y-1">
            {RESOURCES.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={linkCls} title={label}>
                <Icon size={19} className="shrink-0" />
                {wide && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  )
}
