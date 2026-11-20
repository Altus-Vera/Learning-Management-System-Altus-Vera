import { create } from 'zustand'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

type Tone = 'success' | 'error' | 'info'
interface T { id: number; msg: string; tone: Tone }

const useToasts = create<{ items: T[]; push: (msg: string, tone?: Tone) => void }>((set) => ({
  items: [],
  push: (msg, tone = 'success') => {
    const id = Date.now() + Math.random()
    set((s) => ({ items: [...s.items, { id, msg, tone }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3500)
  },
}))

export const toast = (msg: string, tone?: Tone) => useToasts.getState().push(msg, tone)

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info }
const COLOR = { success: 'var(--color-green)', error: 'var(--color-red)', info: 'var(--color-primary)' }

export function Toaster() {
  const items = useToasts((s) => s.items)
  return (
    <div className="fixed bottom-5 right-5 z-[200] space-y-2">
      {items.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div key={t.id} className="card flex items-center gap-3 px-4 py-3 min-w-[280px] animate-in" style={{ borderLeft: `4px solid ${COLOR[t.tone]}` }}>
            <Icon size={18} style={{ color: COLOR[t.tone] }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-heading)' }}>{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}
