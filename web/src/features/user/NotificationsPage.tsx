import { useSearchParams, Link } from 'react-router-dom'
import { Bell, CheckCheck, Settings, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSocialStore } from '../../store/socialStore'
import { fmtDate } from '../../lib/format'

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const notifs = useSocialStore((s) => s.notifications)
  const markRead = useSocialStore((s) => s.markNotificationRead)
  const markAll = useSocialStore((s) => s.markAllNotificationsRead)
  const selId = Number(params.get('id')) || notifs[0]?.id
  const sel = notifs.find((n) => n.id === selId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="mr-auto"><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm muted">{notifs.filter((n) => !n.read).length} unread</p></div>
        <button className="btn btn-secondary btn-sm" onClick={markAll}><CheckCheck size={15} /> Mark all as read</button>
        <Link to="/preferences/notifications" className="btn btn-secondary btn-sm !text-[var(--color-heading)]"><Settings size={15} /> Preferences</Link>
      </div>
      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <div className="card overflow-hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {notifs.length === 0 && <div className="p-10 text-center muted">You have no notifications</div>}
          {notifs.map((n) => (
            <button key={n.id} onClick={() => { markRead(n.id); setParams({ id: String(n.id) }) }} className={`w-full flex items-start gap-3 p-4 text-left ${n.id === selId ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-bg-card-hover)]'}`} style={{ borderColor: 'var(--color-border)' }}>
              <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: n.read ? 'transparent' : 'var(--color-primary)' }} />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`} style={{ color: 'var(--color-heading)' }}>{n.subject}</span>
                <span className="block text-xs muted">{n.component} · {formatDistanceToNow(new Date(n.at), { addSuffix: true })}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="card p-6 h-fit">
          {sel ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}><Bell size={20} /></span>
                <div><h2 className="text-lg font-bold">{sel.subject}</h2><div className="text-xs muted">{sel.component} · {fmtDate(sel.at)}</div></div>
              </div>
              <p className="leading-relaxed">{sel.text}</p>
              <Link to={sel.link} className="btn btn-primary btn-sm mt-5 !text-white"><ExternalLink size={14} /> View full notification</Link>
            </>
          ) : <div className="text-center muted py-10">Select a notification to view it</div>}
        </div>
      </div>
    </div>
  )
}
