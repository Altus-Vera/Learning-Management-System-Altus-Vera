import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, Eye, EyeOff, Pencil, Trash2, Plus, Check, Circle, ChevronsDownUp, ChevronsUpDown, Users, BookOpen, GraduationCap, Search, Star, Settings2 } from 'lucide-react'
import { useLmsStore, courseProgress, assignPhase, CURRENT_STUDENT_ID, STUDENTS, type Activity, type ActivityType, type Course, type Section } from '../../../store/lmsStore'
import { useRole } from '../../../store/uiStore'
import { ActivityIcon, activityLabel } from '../../../components/ActivityIcon'
import { Modal, Confirm } from '../../../components/Modal'
import { toast } from '../../../components/Toast'
import { fmtShort } from '../../../lib/format'
import { CourseBanner } from '../../dashboard/components/CourseCard'
import { CourseGrades } from '../../grades/components/GradesPage'

function AssignMeta({ a }: { a: Activity }) {
  const submissions = useLmsStore((s) => s.submissions)
  const { isTeacher } = useRole()
  if (!a.assign) return null
  const phase = assignPhase(a.assign)
  const sub = submissions[`${a.id}:${CURRENT_STUDENT_ID}`]

  if (isTeacher) {
    const submitted = STUDENTS.filter((st) => submissions[`${a.id}:${st.id}`]?.status === 'submitted').length
    const toGrade = STUDENTS.filter((st) => { const x = submissions[`${a.id}:${st.id}`]; return x?.status === 'submitted' && x.grade === null }).length
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {phase === 'disabled' ? <span className="badge badge-gray">Submissions disabled</span> : phase === 'not-open' ? <span className="badge badge-amber">Opens {fmtShort(a.assign.allowSubmissionsFrom)}</span> : phase === 'closed' ? <span className="badge badge-gray">Closed</span> : <span className="badge badge-green">Accepting submissions</span>}
        <span className="badge badge-blue">{submitted}/{STUDENTS.length} submitted</span>
        {toGrade > 0 && <span className="badge badge-amber">{toGrade} needs grading</span>}
        <span className="text-xs muted">Due {fmtShort(a.assign.dueDate)}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {sub?.status === 'submitted' ? (
        <span className="badge badge-green"><Check size={12} strokeWidth={3} /> Submitted {fmtShort(sub.modifiedAt).split(',')[0]}</span>
      ) : sub?.status === 'draft' ? (
        <span className="badge badge-amber">Draft (not submitted)</span>
      ) : phase === 'not-open' ? (
        <span className="badge badge-gray">Opens {fmtShort(a.assign.allowSubmissionsFrom)}</span>
      ) : (
        <span className={`badge ${phase === 'open' ? 'badge-blue' : 'badge-red'}`}>{phase === 'open' ? 'Due' : 'Overdue ·'} {fmtShort(a.assign.dueDate)}</span>
      )}
      {sub?.grade != null && <span className="badge badge-blue">Grade {sub.grade}/{a.assign.maxGrade}</span>}
      {phase === 'disabled' && sub?.status !== 'submitted' && <span className="badge badge-gray">Not accepting submissions</span>}
    </div>
  )
}

function ActivityRow({ course, a }: { course: Course; a: Activity }) {
  const { isTeacher } = useRole()
  const editMode = useLmsStore((s) => s.editMode) && isTeacher
  const done = useLmsStore((s) => !!s.completion[a.id])
  const submissions = useLmsStore((s) => s.submissions)
  const toggleCompletion = useLmsStore((s) => s.toggleCompletion)
  const setVisible = useLmsStore((s) => s.setActivityVisible)
  const rename = useLmsStore((s) => s.renameActivity)
  const del = useLmsStore((s) => s.deleteActivity)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(a.name)
  const [confirm, setConfirm] = useState(false)

  if (!a.visible && !isTeacher) return null
  const link = a.type === 'assign' ? `/courses/${course.id}/assign/${a.id}` : `/courses/${course.id}/mod/${a.id}`
  const autoDone = a.type === 'assign' && submissions[`${a.id}:${CURRENT_STUDENT_ID}`]?.status === 'submitted'
  const isDone = a.type === 'assign' ? autoDone : done

  return (
    <div id={`a${a.id}`} className={`group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-bg-card-hover)] ${!a.visible ? 'opacity-60' : ''}`}>
      <ActivityIcon type={a.type} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider muted">{activityLabel(a.type)}</div>
        {editing ? (
          <form className="flex gap-2 mt-1" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { rename(a.id, name.trim()); toast('Activity name updated') } setEditing(false) }}>
            <input className="form-control !h-8" value={name} onChange={(e) => setName(e.target.value)} autoFocus onBlur={() => setEditing(false)} onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} />
          </form>
        ) : (
          <Link to={link} className="font-semibold hover:underline" style={{ color: 'var(--color-heading)' }}>{a.name}</Link>
        )}
        {!a.visible && <span className="badge badge-gray ml-2 align-middle">Hidden from students</span>}
        {a.type === 'assign' && <AssignMeta a={a} />}
        {a.type === 'quiz' && a.description && <div className="text-xs muted mt-1">{a.description}</div>}
      </div>

      {editMode ? (
        <div className="flex items-center gap-0.5">
          <button className="icon-btn !w-8 !h-8" title="Edit title" onClick={() => { setName(a.name); setEditing(true) }}><Pencil size={15} /></button>
          {a.type === 'assign' && <Link className="icon-btn !w-8 !h-8" title="Edit settings" to={`${link}?tab=settings`}><Settings2 size={15} /></Link>}
          <button className="icon-btn !w-8 !h-8" title={a.visible ? 'Hide' : 'Show'} onClick={() => { setVisible(a.id, !a.visible); toast(a.visible ? 'Activity hidden from students' : 'Activity is now visible') }}>{a.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
          <button className="icon-btn !w-8 !h-8 hover:!text-[var(--color-red)]" title="Delete" onClick={() => setConfirm(true)}><Trash2 size={15} /></button>
        </div>
      ) : !isTeacher && (
        a.type === 'assign' ? (
          <span className={`badge ${isDone ? 'badge-green' : 'badge-gray'} shrink-0`}>{isDone ? <><Check size={12} strokeWidth={3} /> Done: Make a submission</> : 'To do: Make a submission'}</span>
        ) : (
          <button onClick={() => toggleCompletion(a.id)} className={`btn btn-sm shrink-0 ${isDone ? 'btn-green' : 'btn-secondary'}`}>
            {isDone ? <><Check size={14} strokeWidth={3} /> Done</> : <><Circle size={13} /> Mark as done</>}
          </button>
        )
      )}

      <Confirm open={confirm} danger title="Delete activity?" confirmLabel="Delete"
        message={<>Are you sure you want to delete the {activityLabel(a.type).toLowerCase()} <b>“{a.name}”</b>? All user data related to it will be lost.</>}
        onConfirm={() => { del(a.id); toast('Activity deleted') }} onClose={() => setConfirm(false)} />
    </div>
  )
}

function SectionCard({ course, section, open, onToggle }: { course: Course; section: Section; open: boolean; onToggle: () => void }) {
  const { isTeacher } = useRole()
  const editMode = useLmsStore((s) => s.editMode) && isTeacher
  const completion = useLmsStore((s) => s.completion)
  const submissions = useLmsStore((s) => s.submissions)
  const addActivity = useLmsStore((s) => s.addActivity)
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<ActivityType>('assign')
  const [newName, setNewName] = useState('')

  const visible = section.activities.filter((a) => a.visible || isTeacher)
  const doneCount = visible.filter((a) => (a.type === 'assign' ? submissions[`${a.id}:${CURRENT_STUDENT_ID}`]?.status === 'submitted' : completion[a.id])).length
  if (!visible.length && !editMode && section.id !== 1) return (
    <div id={`s${section.id}`} className="card px-5 py-4 flex items-center"><span className="font-bold" style={{ color: 'var(--color-heading)' }}>{section.title}</span></div>
  )

  return (
    <div id={`s${section.id}`} className="card overflow-hidden scroll-mt-24">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <ChevronDown size={18} className={`muted transition-transform ${open ? '' : '-rotate-90'}`} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px]" style={{ color: 'var(--color-heading)' }}>{section.title}</div>
          {section.summary && <div className="text-sm muted truncate">{section.summary}</div>}
        </div>
        {!isTeacher && visible.length > 0 && <span className="text-xs font-semibold muted">{doneCount}/{visible.length}</span>}
      </button>
      {open && (
        <div className="divide-y border-t" style={{ borderColor: 'var(--color-border)' }}>
          {visible.map((a) => <ActivityRow key={a.id} course={course} a={a} />)}
          {visible.length === 0 && <div className="px-5 py-6 text-sm muted text-center">This section is empty.</div>}
          {editMode && (
            <div className="px-5 py-3">
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-primary)' }} onClick={() => { setNewName(''); setAdding(true) }}><Plus size={15} /> Add an activity or resource</button>
            </div>
          )}
        </div>
      )}
      <Modal open={adding} title={`Add an activity or resource to “${section.title}”`} onClose={() => setAdding(false)} width={620}
        footer={<><button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" disabled={!newName.trim()} onClick={() => { addActivity(course.id, section.id, newType, newName.trim()); setAdding(false); toast(`${activityLabel(newType)} added`) }}>Save and return to course</button></>}>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-5">
          {(['assign', 'quiz', 'forum', 'resource', 'url', 'folder', 'choice'] as ActivityType[]).map((t) => (
            <button key={t} onClick={() => setNewType(t)} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors ${newType === t ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-transparent hover:bg-[var(--color-bg-subtle)]'}`}>
              <ActivityIcon type={t} size={44} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-heading)' }}>{activityLabel(t)}</span>
            </button>
          ))}
        </div>
        <label className="form-label">Name <span style={{ color: 'var(--color-red)' }}>*</span></label>
        <input className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`e.g. ${newType === 'assign' ? 'Tutorial 11' : 'Lecture Note 11'}`} autoFocus />
        {newType === 'assign' && <p className="text-xs muted mt-2">Default availability: opens now, due in 7 days, cut-off in 9 days. You can change these in the assignment settings.</p>}
      </Modal>
    </div>
  )
}

function Participants({ course }: { course: Course }) {
  const [q, setQ] = useState('')
  const rows = [{ id: 'l1', name: course.lecturer, email: `${course.lecturer.split(' ').pop()?.toLowerCase()}@altusvera.lk`, role: 'Lecturer' }, ...STUDENTS.map((s) => ({ ...s, role: 'Student' }))]
    .filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mr-auto"><h2 className="font-bold">Participants</h2><div className="text-sm muted">{rows.length} participants found</div></div>
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9 !w-64" placeholder="Search keyword or name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
            <th className="px-5 py-3 font-semibold">First name / Last name</th><th className="px-5 py-3 font-semibold">Email address</th><th className="px-5 py-3 font-semibold">Roles</th><th className="px-5 py-3 font-semibold">Groups</th><th className="px-5 py-3 font-semibold">Last access to course</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-5 py-3"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{r.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span><span className="font-medium" style={{ color: 'var(--color-heading)' }}>{r.name}</span></div></td>
                <td className="px-5 py-3 muted">{r.email}</td>
                <td className="px-5 py-3"><span className={`badge ${r.role === 'Lecturer' ? 'badge-amber' : 'badge-blue'}`}>{r.role}</span></td>
                <td className="px-5 py-3 muted">{r.role === 'Student' ? `Group ${(i % 3) + 1}` : 'No groups'}</td>
                <td className="px-5 py-3 muted">{i === 0 ? 'Now' : `${i * 3} hours ${i * 7 % 60} mins`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CoursePage() {
  const { courseId } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') ?? 'course') as 'course' | 'participants' | 'grades'
  const course = useLmsStore((s) => s.courses.find((c) => c.id === Number(courseId)))
  const completion = useLmsStore((s) => s.completion)
  const editMode = useLmsStore((s) => s.editMode)
  const setEditMode = useLmsStore((s) => s.setEditMode)
  const touch = useLmsStore((s) => s.touchCourse)
  const toggleStar = useLmsStore((s) => s.toggleStar)
  const { isTeacher } = useRole()
  const [closed, setClosed] = useState<Record<number, boolean>>({})

  useEffect(() => { if (course) touch(course.id) }, [course?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const progress = useMemo(() => (course ? courseProgress(course, completion) : 0), [course, completion])
  if (!course) return <Navigate to="/dashboard" replace />

  const allClosed = course.sections.every((s) => closed[s.id])
  const setTab = (t: string) => setParams(t === 'course' ? {} : { tab: t })

  return (
    <div className="space-y-6">
      <nav className="text-sm muted flex items-center gap-1.5 flex-wrap">
        <Link to="/dashboard" className="muted hover:underline">Dashboard</Link><span>/</span>
        <Link to="/courses" className="muted hover:underline">My courses</Link><span>/</span>
        <span style={{ color: 'var(--color-heading)' }}>{course.shortName}</span>
      </nav>

      <div className="card overflow-hidden">
        <CourseBanner course={course} className="h-36" />
        <div className="p-6 flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[260px]">
            <div className="text-sm muted mb-1">{course.category} · {course.term}</div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {course.shortName}-{course.fullName}
              <button onClick={() => toggleStar(course.id)} title={course.starred ? 'Unstar' : 'Star'}><Star size={20} fill={course.starred ? 'var(--color-amber)' : 'none'} color={course.starred ? 'var(--color-amber)' : 'var(--color-text-muted)'} /></button>
            </h1>
            <div className="text-sm muted mt-1">Lecturer: {course.lecturer}</div>
          </div>
          {!isTeacher ? (
            <div className="w-64">
              <div className="flex justify-between text-sm mb-1.5"><span className="muted">Your progress</span><span className="font-bold" style={{ color: 'var(--color-heading)' }}>{progress}%</span></div>
              <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-heading)' }}>Edit mode</span>
              <button className="switch" data-on={editMode} onClick={() => setEditMode(!editMode)} aria-label="Toggle edit mode" />
            </label>
          )}
        </div>
        <div className="flex gap-1 px-4 border-t overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
          {([['course', 'Course', BookOpen], ['participants', 'Participants', Users], ['grades', 'Grades', GraduationCap]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`tab flex items-center gap-2 ${tab === k ? 'tab-active' : ''}`}><Icon size={16} />{l}</button>
          ))}
        </div>
      </div>

      {tab === 'participants' ? <Participants course={course} /> : tab === 'grades' ? <CourseGrades course={course} /> : (
        <div className="grid xl:grid-cols-[260px_minmax(0,1fr)] gap-6">
          <aside className="hidden xl:block">
            <div className="card p-4 sticky top-24">
              <div className="text-xs font-bold uppercase tracking-wider muted mb-2 px-2">Course index</div>
              {course.sections.map((s) => (
                <a key={s.id} href={`#s${s.id}`} onClick={() => setClosed((c) => ({ ...c, [s.id]: false }))} className="block px-2 py-1.5 rounded-lg text-sm hover:bg-[var(--color-bg-subtle)]" style={{ color: 'var(--color-heading)' }}>{s.title}</a>
              ))}
            </div>
          </aside>
          <div className="space-y-4 min-w-0">
            <div className="flex justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => setClosed(allClosed ? {} : Object.fromEntries(course.sections.map((s) => [s.id, true])))}>
                {allClosed ? <><ChevronsUpDown size={15} /> Expand all</> : <><ChevronsDownUp size={15} /> Collapse all</>}
              </button>
            </div>
            {course.sections.map((s) => <SectionCard key={s.id} course={course} section={s} open={!closed[s.id]} onToggle={() => setClosed((c) => ({ ...c, [s.id]: !c[s.id] }))} />)}
          </div>
        </div>
      )}
    </div>
  )
}
