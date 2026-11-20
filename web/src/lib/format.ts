import { format, formatDistanceStrict, isToday, isTomorrow } from 'date-fns'

export const fmtDate = (iso: string | null) => (iso ? format(new Date(iso), 'EEEE, d MMMM yyyy, h:mm a') : '—')
export const fmtShort = (iso: string | null) => (iso ? format(new Date(iso), 'd MMM yyyy, h:mm a') : '—')
export const fmtDay = (iso: string) => {
  const t = new Date(iso)
  if (isToday(t)) return 'Today'
  if (isTomorrow(t)) return 'Tomorrow'
  return format(t, 'EEE, d MMM')
}
export const fmtTime = (iso: string) => format(new Date(iso), 'h:mm a')
export const fmtSize = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export const timeLeft = (iso: string | null, now = new Date()) => {
  if (!iso) return '—'
  const t = new Date(iso)
  const dist = formatDistanceStrict(t, now)
  return t > now ? `${dist} remaining` : `Assignment is overdue by: ${dist}`
}

export const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '')
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
