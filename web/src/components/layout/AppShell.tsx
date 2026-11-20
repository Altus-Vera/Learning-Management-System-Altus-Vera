import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MessageDrawer } from '../../features/messages/MessageDrawer'
import { useUiStore } from '../../store/uiStore'

export function AppShell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [mobileOpen, setMobileOpen] = useState(false)
  const messages = useUiStore((s) => s.messages)
  const closeMessages = useUiStore((s) => s.closeMessages)

  if (!isAuthenticated()) return <Navigate to="/login" replace />

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
