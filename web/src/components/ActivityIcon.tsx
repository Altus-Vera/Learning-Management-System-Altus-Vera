import { FileText, ClipboardCheck, MessagesSquare, ListChecks, Link2, Folder, Vote, MessageSquareHeart, StickyNote, Type } from 'lucide-react'
import type { ActivityType } from '../store/lmsStore'

const MAP: Record<ActivityType, { icon: typeof FileText; bg: string; fg: string; label: string }> = {
  assign:   { icon: ClipboardCheck, bg: '#E6ECF8', fg: '#0033A0', label: 'Assignment' },
  resource: { icon: FileText,       bg: '#FDECEC', fg: '#DC2626', label: 'File' },
  forum:    { icon: MessagesSquare, bg: '#F3E8FF', fg: '#7C3AED', label: 'Forum' },
  quiz:     { icon: ListChecks,     bg: '#FEF3C7', fg: '#D97706', label: 'Quiz' },
  url:      { icon: Link2,          bg: '#E0F7F4', fg: '#0D9488', label: 'URL' },
  folder:   { icon: Folder,         bg: '#E0F2FE', fg: '#0284C7', label: 'Folder' },
  choice:   { icon: Vote,           bg: '#FCE7F3', fg: '#DB2777', label: 'Group choice' },
  feedback: { icon: MessageSquareHeart, bg: '#ECFCCB', fg: '#65A30D', label: 'Feedback' },
  page:     { icon: StickyNote,     bg: '#E0E7FF', fg: '#4F46E5', label: 'Page' },
  label:    { icon: Type,           bg: '#F1F5F9', fg: '#64748B', label: 'Text and media area' },
}

export const activityLabel = (t: ActivityType) => MAP[t].label

export function ActivityIcon({ type, size = 40 }: { type: ActivityType; size?: number }) {
  const m = MAP[type]
  const Icon = m.icon
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-xl"
      style={{ width: size, height: size, background: m.bg, color: m.fg }}
    >
      <Icon size={size * 0.48} strokeWidth={2} />
    </span>
  )
}
