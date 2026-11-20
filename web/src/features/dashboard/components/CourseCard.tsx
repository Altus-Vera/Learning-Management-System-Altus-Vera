import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreVertical, Star, EyeOff, Eye } from 'lucide-react'
import { useLmsStore, courseProgress, type Course } from '../../../store/lmsStore'

export function CourseBanner({ course, className = '' }: { course: Course; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${course.color}, color-mix(in srgb, ${course.color} 55%, #0F172A))` }}>
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
        <defs><pattern id={`p${course.id}`} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" /></pattern></defs>
        <rect width="100%" height="100%" fill={`url(#p${course.id})`} />
      </svg>
      <div className="absolute -right-6 -bottom-10 w-36 h-36 rounded-full bg-white/10" />
      <div className="absolute right-16 -top-12 w-28 h-28 rounded-full bg-white/10" />
      <span className="absolute left-4 bottom-3 text-white/90 text-xs font-bold tracking-wider">{course.shortName}</span>
    </div>
  )
}

export function CourseMenu({ course }: { course: Course }) {
  const [open, setOpen] = useState(false)
  const toggleStar = useLmsStore((s) => s.toggleStar)
  const toggleHidden = useLmsStore((s) => s.toggleHidden)
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v) }}
        className="w-8 h-8 rounded-lg grid place-items-center hover:bg-[var(--color-bg-subtle)] muted"
        aria-label="Course actions"
      >
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="dropdown-menu right-0 top-8" onClick={(e) => { e.preventDefault(); setOpen(false) }}>
          <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => toggleStar(course.id)}>
            <Star size={15} /> {course.starred ? 'Unstar this course' : 'Star this course'}
          </button>
          <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => toggleHidden(course.id)}>
            {course.hidden ? <Eye size={15} /> : <EyeOff size={15} />} {course.hidden ? 'Restore to view' : 'Remove from view'}
          </button>
        </div>
      )}
    </div>
  )
}

export function CourseCard({ course }: { course: Course }) {
  const completion = useLmsStore((s) => s.completion)
  const p = courseProgress(course, completion)
  return (
    <Link to={`/courses/${course.id}`} className="card group overflow-hidden flex flex-col hover:-translate-y-0.5 transition-transform !text-inherit">
      <CourseBanner course={course} className="h-28" />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium muted mb-1 flex items-center gap-1.5">
              {course.starred && <Star size={12} fill="var(--color-amber)" color="var(--color-amber)" />}
              {course.term}
            </div>
            <div className="font-semibold leading-snug line-clamp-2 group-hover:text-[var(--color-primary)]" style={{ color: 'var(--color-heading)' }}>
              {course.shortName}-{course.fullName}
            </div>
          </div>
          <CourseMenu course={course} />
        </div>
        <div className="mt-auto pt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="muted">{course.lecturer}</span>
            <span className="font-semibold" style={{ color: 'var(--color-heading)' }}>{p}%</span>
          </div>
          <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${p}%` }} /></div>
        </div>
      </div>
    </Link>
  )
}
