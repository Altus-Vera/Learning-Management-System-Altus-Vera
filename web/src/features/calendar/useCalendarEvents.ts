import { useMemo } from 'react'
import { useLmsStore } from '../../store/lmsStore'

export interface CalItem { key: string; id: number; title: string; date: string; type: 'due' | 'user' | 'course' | 'site'; courseId?: number; courseName?: string; link?: string; editable: boolean }

export const EVENT_COLORS: Record<CalItem['type'], string> = { due: '#DC2626', course: '#D97706', user: '#0033A0', site: '#0D9488' }
export const EVENT_LABELS: Record<CalItem['type'], string> = { due: 'Due date', course: 'Course event', user: 'User event', site: 'Site event' }

export function useCalendarEvents() {
  const courses = useLmsStore((s) => s.courses)
  const events = useLmsStore((s) => s.events)
  return useMemo(() => {
    const out: CalItem[] = []
    courses.forEach((c) => {
      if (c.hidden) return
      c.sections.forEach((s) => s.activities.forEach((a) => {
        if (a.type === 'assign' && a.visible && a.assign?.dueDate)
          out.push({ key: `a${a.id}`, id: a.id, title: `${a.name} is due`, date: a.assign.dueDate, type: 'due', courseId: c.id, courseName: `${c.shortName}-${c.fullName}`, link: `/courses/${c.id}/assign/${a.id}`, editable: false })
      }))
    })
    events.forEach((e) => {
      const c = courses.find((x) => x.id === e.courseId)
      out.push({ key: `e${e.id}`, id: e.id, title: e.title, date: e.date, type: e.type, courseId: e.courseId, courseName: c ? `${c.shortName}-${c.fullName}` : undefined, editable: true })
    })
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [courses, events])
}
