import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { RefreshCw, WifiOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MessageDrawer } from '../../features/messages/MessageDrawer'
import { useUiStore } from '../../store/uiStore'
import { loadBootstrap, startPrefsSync, useSyncStore } from '../../services/sync'

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const [mobileOpen, setMobileOpen] = useState(false)
  const messages = useUiStore((s) => s.messages)
  const closeMessages = useUiStore((s) => s.closeMessages)
  const { ready, error } = useSyncStore()

  useEffect(() => {
    if (!user) return
    useSyncStore.setState({ ready: false, error: null })
    loadBootstrap().catch(() => undefined)
    return startPrefsSync()
  }, [user?.userId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <Navigate to="/login" replace />

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--color-bg-page)' }}>
        {error ? (
          <div className="card p-8 text-center max-w-sm">
            <WifiOff size={36} className="mx-auto" style={{ color: 'var(--color-red)' }} />
            <div className="font-bold mt-3" style={{ color: 'var(--color-heading)' }}>Unable to load your data</div>
            <p className="text-sm muted mt-1">{error}</p>
            <button className="btn btn-primary mt-5" onClick={() => loadBootstrap().catch(() => undefined)}><RefreshCw size={16} /> Try again</button>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-10 h-10 mx-auto rounded-full border-[3px] animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
            <div className="text-sm muted mt-3">Loading your courses…</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg-page)' }}>
      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMobileMenu={() => setMobileOpen(true)} />
        <MessageDrawer open={messages.open} startWith={messages.startWith} onClose={closeMessages} />
        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8">
          <div className="mx-auto max-w-[1400px] animate-in">
            <Outlet />
          </div>
        </main>
        <footer className="px-8 py-5 text-xs muted border-t flex flex-wrap gap-x-6 gap-y-1 justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <span>© {new Date().getFullYear()} Altus Vera Learning Management System</span>
          <span>Data retention summary · Get the mobile app · Policies</span>
        </footer>
      </div>
    </div>
  )
}
