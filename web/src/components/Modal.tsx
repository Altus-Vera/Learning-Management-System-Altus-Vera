import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ open, title, onClose, children, footer, width = 520 }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-slate-900/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="card w-full max-h-[90vh] flex flex-col animate-in" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="icon-btn !w-8 !h-8" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onClose} width={440}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button></>}>
      <div className="text-sm">{message}</div>
    </Modal>
  )
}
