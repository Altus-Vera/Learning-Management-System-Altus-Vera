import { isAxiosError } from 'axios'
import { api } from './api'
import { toast } from '../components/Toast'
import { useLmsStore, STUDENTS, setCurrentUserId, type Course, type Submission, type LmsEvent } from '../store/lmsStore'
import { useActivityStore } from '../store/activityStore'
import { useSocialStore, PEOPLE, type Person } from '../store/socialStore'
import { useAdminStore, BATCHES, LECTURERS, type StudentRecord, type Batch } from '../store/adminStore'
import { usePrefsStore } from '../store/prefsStore'
import { create } from 'zustand'

interface PersonDto { id: string; name: string; email: string; role: string; indexNo: string | null; batchId: string | null; phone: string | null }

export const useSyncStore = create<{ ready: boolean; loading: boolean; error: string | null }>(() => ({ ready: false, loading: false, error: null }))

const replace = <T,>(target: T[], items: T[]) => { target.splice(0, target.length, ...items) }

let inflight: Promise<void> | null = null
let prefsHydrating = false

export function loadBootstrap(): Promise<void> {
  if (inflight) return inflight
  useSyncStore.setState({ loading: true })
  inflight = api.get('/api/v1/bootstrap').then(({ data }) => {
    setCurrentUserId(data.me.id)
    const people: PersonDto[] = data.people
    replace(PEOPLE, people.filter((p) => p.role !== 'Admin').map((p): Person => ({ id: p.id, name: p.name, role: p.role === 'Lecturer' ? 'Lecturer' : 'Student' })))
    const students = people.filter((p) => p.role === 'Student')
    replace(STUDENTS, students.map((s) => ({ id: s.id, name: s.name, email: s.email })))
    replace(LECTURERS, people.filter((p) => p.role === 'Lecturer').map((p) => ({ id: p.id, name: p.name })))
    replace(BATCHES, data.admin.batches as Batch[])

    useLmsStore.setState({
      courses: data.lms.courses as Course[],
      submissions: data.lms.submissions as Record<string, Submission>,
      completion: data.lms.completion,
      events: data.lms.events as LmsEvent[],
    })
    useActivityStore.setState({
      forums: data.activity.forums, subscriptions: data.activity.subscriptions, starredDiscussions: data.activity.starredDiscussions,
      attempts: data.activity.attempts, feedback: data.activity.feedback, feedbackDone: data.activity.feedbackDone,
      groups: data.activity.groups, comments: data.activity.comments,
    })
    useSocialStore.setState({
      conversations: data.social.conversations, contacts: data.social.contacts, requests: data.social.requests,
      sentRequests: data.social.sentRequests, blocked: data.social.blocked, notifications: data.social.notifications,
      ...(data.prefs?.social ?? {}),
    })
    useAdminStore.setState({
      students: students.map((s): StudentRecord => ({ id: s.id, name: s.name, email: s.email, batchId: s.batchId ?? '', indexNo: s.indexNo ?? '', phone: s.phone ?? '' })),
      enrolments: data.admin.enrolments, courseLecturers: data.admin.courseLecturers, payments: data.admin.payments,
      accountBlocks: data.admin.accountBlocks, courseBlocks: data.admin.courseBlocks, extensions: data.admin.extensions,
      overrides: data.admin.overrides, autoBlockUnpaid: data.admin.autoBlockUnpaid, audit: data.admin.audit,
    })
    if (data.prefs?.prefs) {
      prefsHydrating = true
      usePrefsStore.setState(data.prefs.prefs)
      prefsHydrating = false
    }
    useSyncStore.setState({ ready: true, loading: false, error: null })
  }).catch((e) => {
    useSyncStore.setState({ loading: false, error: errorMessage(e) })
    throw e
  }).finally(() => { inflight = null })
  return inflight
}

export const errorMessage = (e: unknown) =>
  isAxiosError(e) ? (e.response?.data?.error ?? (e.response ? `Request failed (${e.response.status})` : 'Unable to connect to the server.')) : 'Something went wrong.'

/** Runs a server mutation, then reloads all data so every view reflects the saved state. */
export async function call<T>(fn: () => Promise<T>, opts: { success?: string; reload?: boolean } = {}): Promise<T | undefined> {
  try {
    const result = await fn()
    if (opts.reload !== false) await loadBootstrap().catch(() => undefined)
    if (opts.success) toast(opts.success)
    return result
  } catch (e) {
    toast(errorMessage(e), 'error')
    await loadBootstrap().catch(() => undefined)
    return undefined
  }
}

let prefsTimer: ReturnType<typeof setTimeout> | undefined
export function startPrefsSync() {
  const save = () => {
    if (prefsHydrating || !useSyncStore.getState().ready) return
    clearTimeout(prefsTimer)
    prefsTimer = setTimeout(() => {
      const p = usePrefsStore.getState()
      const s = useSocialStore.getState()
      const prefs = { profile: p.profile, language: p.language, forum: p.forum, editor: p.editor, activityChooser: p.activityChooser, calendar: p.calendar, badges: p.badges, notifDisabled: p.notifDisabled, notif: p.notif, blockOrder: p.blockOrder, hiddenBlocks: p.hiddenBlocks, hideBlocks: p.hideBlocks }
      api.put('/api/v1/me/preferences', { prefs, social: { privacy: s.privacy, enterToSend: s.enterToSend } }).catch(() => toast('Could not save your preferences', 'error'))
    }, 600)
  }
  const unsubPrefs = usePrefsStore.subscribe(save)
  const unsubSocial = useSocialStore.subscribe((s, prev) => { if (s.privacy !== prev.privacy || s.enterToSend !== prev.enterToSend) save() })
  return () => { unsubPrefs(); unsubSocial() }
}
