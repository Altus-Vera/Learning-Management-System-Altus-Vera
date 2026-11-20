import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, PanelLeft, Search, Bell, MessageCircle, Moon, Sun, User, GraduationCap, CalendarDays, FolderLock, LogOut, Eye, ChevronDown, ClipboardCheck } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useLmsStore, assignPhase, CURRENT_STUDENT_ID, STUDENTS } from '../../store/lmsStore'
import { useRole, useUiStore } from '../../store/uiStore'
import { fmtDay, fmtTime, initials } from '../../lib/format'

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, close])
  return ref
}

export function Topbar({ onMobileMenu }: { onMobileMenu: () => void }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, toggleTheme } = useThemeStore()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const { canTeach, isTeacher } = useRole()
  const setViewAsStudent = useUiStore((s) => s.setViewAsStudent)
  const courses = useLmsStore((s) => s.courses)
  const submissions = useLmsStore((s) => s.submissions)
  const navigate = useNavigate()

  const [menu, setMenu] = useState<null | 'notif' | 'msg' | 'user'>(null)
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const close = () => setMenu(null)
  const menuRef = useOutside(menu !== null, close)
  const searchRef = useOutside(searchOpen, () => setSearchOpen(false))

  const name = user?.fullName ?? 'User'

  const notifications = useMemo(() => {
    const out: { id: number; courseId: number; title: string; course: string; due: string }[] = []
    courses.forEach((c) => c.sections.forEach((s) => s.activities.forEach((a) => {
      if (a.type !== 'assign' || !a.visible || !a.assign?.dueDate) return
      if (isTeacher) {
        const pending = STUDENTS.filter((st) => { const sb = submissions[`${a.id}:${st.id}`]; return sb?.status === 'submitted' && sb.grade === null }).length
        if (pending) out.push({ id: a.id, courseId: c.id, title: `${a.name}: ${pending} submission${pending > 1 ? 's' : ''} need grading`, course: c.shortName, due: a.assign.dueDate })
        return
      }
      const sub = submissions[`${a.id}:${CURRENT_STUDENT_ID}`]
      const phase = assignPhase(a.assign)
      if ((phase === 'open' || phase === 'overdue') && sub?.status !== 'submitted') out.push({ id: a.id, courseId: c.id, title: `${a.name} is due`, course: c.shortName, due: a.assign.dueDate })
    })))
    return out.sort((x, y) => x.due.localeCompare(y.due)).slice(0, 6)
  }, [courses, submissions, isTeacher])

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const r: { label: string; sub: string; to: string }[] = []
    courses.forEach((c) => {
      if (`${c.shortName} ${c.fullName}`.toLowerCase().includes(t)) r.push({ label: `${c.shortName} — ${c.fullName}`, sub: 'Course', to: `/courses/${c.id}` })
      c.sections.forEach((s) => s.activities.forEach((a) => {
        if (a.name.toLowerCase().includes(t) && (a.visible || isTeacher)) r.push({ label: a.name, sub: c.shortName, to: a.type === 'assign' ? `/courses/${c.id}/assign/${a.id}` : `/courses/${c.id}#a${a.id}` })
      }))
    })
    return r.slice(0, 8)
  }, [q, courses, isTeacher])

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center gap-2 px-4 lg:px-6 border-b backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--color-bg-header) 85%, transparent)', borderColor: 'var(--color-border)' }}
    >
      <button className="icon-btn lg:hidden" onClick={onMobileMenu} aria-label="Open menu"><Menu size={20} /></button>
      <button className="icon-btn hidden lg:inline-flex" onClick={toggleSidebar} aria-label="Collapse sidebar"><PanelLeft size={20} /></button>

      <div ref={searchRef} className="relative flex-1 max-w-xl">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search courses and activities…"
          className="form-control pl-10 !bg-[var(--color-bg-subtle)] !border-transparent focus:!border-[var(--color-primary)]"
        />
        {searchOpen && q && (
          <div className="dropdown-menu left-0 right-0 top-12">
            {results.length === 0 && <div className="px-4 py-3 text-sm muted">No results for “{q}”</div>}
            {results.map((r) => (
              <button key={r.to + r.label} className="dropdown-item w-[calc(100%-12px)] text-left" onClick={() => { navigate(r.to); setQ(''); setSearchOpen(false) }}>
                <span className="flex-1 truncate">{r.label}</span>
                <span className="badge badge-gray">{r.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={menuRef} className="ml-auto flex items-center gap-1">
        {canTeach && !isTeacher && (
          <button className="badge badge-amber mr-2 cursor-pointer" onClick={() => setViewAsStudent(false)} title="Return to lecturer view">
            <Eye size={13} /> Viewing as student · Exit
          </button>
        )}

        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>

        <div className="relative">
          <button className="icon-btn relative" onClick={() => setMenu(menu === 'notif' ? null : 'notif')} aria-label="Notifications">
            <Bell size={19} />
            {notifications.length > 0 && <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white grid place-items-center" style={{ background: 'var(--color-red)' }}>{notifications.length}</span>}
          </button>
          {menu === 'notif' && (
            <div className="dropdown-menu right-0 top-12 w-[360px]">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="font-semibold" style={{ color: 'var(--color-heading)' }}>Notifications</span>
                <span className="text-xs muted">{notifications.length} pending</span>
              </div>
              {notifications.length === 0 && <div className="px-4 py-6 text-center text-sm muted">You have no notifications</div>}
              {notifications.map((n) => (
                <Link key={n.id} to={`/courses/${n.courseId}/assign/${n.id}${isTeacher ? '?tab=submissions' : ''}`} onClick={close} className="dropdown-item !items-start">
                  <ClipboardCheck size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <span className="flex-1">
                    <span className="block font-medium" style={{ color: 'var(--color-heading)' }}>{n.title}</span>
                    <span className="block text-xs muted">{n.course} · {fmtDay(n.due)}, {fmtTime(n.due)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button className="icon-btn" onClick={() => setMenu(menu === 'msg' ? null : 'msg')} aria-label="Messages"><MessageCircle size={19} /></button>
          {menu === 'msg' && (
            <div className="dropdown-menu right-0 top-12 w-[320px]">
              <div className="px-4 py-2 font-semibold" style={{ color: 'var(--color-heading)' }}>Messages</div>
              <div className="px-4 py-6 text-center text-sm muted">No messages yet. Starred, group and private conversations will appear here.</div>
            </div>
          )}
        </div>

        <div className="relative ml-1">
          <button className="flex items-center gap-2.5 h-10 pl-1 pr-2 rounded-xl hover:bg-[var(--color-bg-subtle)]" onClick={() => setMenu(menu === 'user' ? null : 'user')}>
            <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#00B3A1,#2554C7)' }}>{initials(name)}</span>
            <span className="hidden md:block text-left leading-tight">
              <span className="block text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>{name}</span>
              <span className="block text-[11px] muted">{user?.role}</span>
            </span>
            <ChevronDown size={15} className="muted hidden md:block" />
          </button>
          {menu === 'user' && (
            <div className="dropdown-menu right-0 top-12 w-[240px]" onClick={close}>
              <Link to="/profile" className="dropdown-item"><User size={16} /> Profile</Link>
              <Link to="/grades" className="dropdown-item"><GraduationCap size={16} /> Grades</Link>
              <Link to="/calendar" className="dropdown-item"><CalendarDays size={16} /> Calendar</Link>
              <Link to="/files" className="dropdown-item"><FolderLock size={16} /> Private files</Link>
              {canTeach && (
                <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => setViewAsStudent(isTeacher)}>
                  <Eye size={16} /> {isTeacher ? 'Switch role to student' : 'Return to my normal role'}
                </button>
              )}
              <div className="my-1.5 border-t" style={{ borderColor: 'var(--color-border)' }} />
              <button className="dropdown-item w-[calc(100%-12px)]" style={{ color: 'var(--color-red)' }} onClick={() => { logout(); navigate('/login') }}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
