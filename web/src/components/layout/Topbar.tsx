import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, PanelLeft, Search, Bell, MessageCircle, Moon, Sun, User, GraduationCap, CalendarDays, LogOut, Eye, ChevronDown, CheckCheck, Settings, LayoutDashboard, SlidersHorizontal } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useLmsStore } from '../../store/lmsStore'
import { useSocialStore } from '../../store/socialStore'
import { useRole, useUiStore } from '../../store/uiStore'
import { initials } from '../../lib/format'

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
  const navigate = useNavigate()

  const [menu, setMenu] = useState<null | 'notif' | 'msg' | 'user'>(null)
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const close = () => setMenu(null)
  const menuRef = useOutside(menu !== null, close)
  const searchRef = useOutside(searchOpen, () => setSearchOpen(false))

  const name = user?.fullName ?? 'User'

  const notifs = useSocialStore((s) => s.notifications)
  const markNotificationRead = useSocialStore((s) => s.markNotificationRead)
  const markAllNotificationsRead = useSocialStore((s) => s.markAllNotificationsRead)
  const conversations = useSocialStore((s) => s.conversations)
  const openMessages = useUiStore((s) => s.openMessages)
  const unreadNotif = notifs.filter((n) => !n.read).length
  const unreadMsgs = conversations.filter((c) => c.unread > 0 && !c.muted).length

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
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { navigate(`/search?q=${encodeURIComponent(q.trim())}`); setQ(''); setSearchOpen(false) } }}
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
            {unreadNotif > 0 && <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white grid place-items-center" style={{ background: 'var(--color-red)' }}>{unreadNotif}</span>}
          </button>
          {menu === 'notif' && (
            <div className="dropdown-menu right-0 top-12 w-[380px] !py-0 overflow-hidden">
              <div className="flex items-center gap-1 px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span className="font-semibold mr-auto" style={{ color: 'var(--color-heading)' }}>Notifications</span>
                <button className="icon-btn !w-8 !h-8" title="Mark all as read" onClick={markAllNotificationsRead}><CheckCheck size={16} /></button>
                <Link to="/preferences/notifications" onClick={close} className="icon-btn !w-8 !h-8" title="Notification preferences"><Settings size={16} /></Link>
              </div>
              <div className="max-h-[380px] overflow-y-auto py-1">
                {notifs.length === 0 && <div className="px-4 py-6 text-center text-sm muted">You have no notifications</div>}
                {notifs.slice(0, 8).map((n) => (
                  <Link key={n.id} to={`/notifications?id=${n.id}`} onClick={() => { markNotificationRead(n.id); close() }} className="dropdown-item !items-start">
                    <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: n.read ? 'transparent' : 'var(--color-primary)' }} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`} style={{ color: 'var(--color-heading)' }}>{n.subject}</span>
                      <span className="block text-xs muted">{formatDistanceToNow(new Date(n.at), { addSuffix: true })}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <Link to="/notifications" onClick={close} className="block text-center text-sm font-semibold py-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>See all</Link>
            </div>
          )}
        </div>

        <button className="icon-btn relative" onClick={() => openMessages()} aria-label="Messages">
          <MessageCircle size={19} />
          {unreadMsgs > 0 && <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white grid place-items-center" style={{ background: 'var(--color-primary)' }}>{unreadMsgs}</span>}
        </button>

        <div className="relative ml-1">
          <button className="flex items-center gap-2.5 h-10 pl-1 pr-2 rounded-xl hover:bg-[var(--color-bg-subtle)]" onClick={() => setMenu(menu === 'user' ? null : 'user')}>
            <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#00B3A1,#0033A0)' }}>{initials(name)}</span>
            <span className="hidden md:block text-left leading-tight">
              <span className="block text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>{name}</span>
              <span className="block text-[11px] muted">{user?.role}</span>
            </span>
            <ChevronDown size={15} className="muted hidden md:block" />
          </button>
          {menu === 'user' && (
            <div className="dropdown-menu right-0 top-12 w-[240px]" onClick={close}>
              <Link to="/dashboard" className="dropdown-item"><LayoutDashboard size={16} /> Dashboard</Link>
              <Link to="/profile" className="dropdown-item"><User size={16} /> Profile</Link>
              <Link to="/grades" className="dropdown-item"><GraduationCap size={16} /> Grades</Link>
              <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => openMessages()}><MessageCircle size={16} /> Messages</button>
              <Link to="/preferences" className="dropdown-item"><SlidersHorizontal size={16} /> Preferences</Link>
              <Link to="/calendar" className="dropdown-item"><CalendarDays size={16} /> Calendar</Link>
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
