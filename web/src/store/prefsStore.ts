import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BlockId = 'timeline' | 'calendar' | 'upcoming' | 'privatefiles' | 'onlineusers' | 'badges'
export const BLOCK_LABELS: Record<BlockId, string> = { timeline: 'Timeline', calendar: 'Calendar', upcoming: 'Upcoming events', privatefiles: 'Private files', onlineusers: 'Online users', badges: 'Latest badges' }

export interface Profile {
  firstName: string; surname: string; emailDisplay: 'hide' | 'everyone' | 'courses'; city: string; country: string; timezone: string; description: string
  interests: string; webPage: string; institution: string; department: string; phone: string; mobile: string; address: string; idNumber: string
  middleName: string; alternateName: string
}

export interface NotifPref { webIn: boolean; webOut: boolean; emailIn: boolean; emailOut: boolean }
export const NOTIF_COMPONENTS: { group: string; items: string[] }[] = [
  { group: 'Assignment', items: ['Assignment notifications'] },
  { group: 'Feedback', items: ['Feedback notifications', 'Feedback reminder'] },
  { group: 'Forum', items: ['Subscribed forum posts', 'Subscribed forum digests'] },
  { group: 'Quiz', items: ['Confirmation of your own quiz submissions', 'Notification that your quiz attempt is due soon'] },
  { group: 'System', items: ['Badge recipient notifications', 'Message contact requests notification', 'Grade notifications', 'Manual enrolment expiry notifications'] },
  { group: 'Turnitin Integrity plugin', items: ['Turnitin new EULA release'] },
  { group: 'Data privacy', items: ['Data request processing results'] },
]

interface PrefsState {
  profile: Profile
  language: string
  forum: { digest: 'none' | 'complete' | 'subjects'; autoSubscribe: boolean; tracking: boolean; markRead: boolean; nested: boolean }
  editor: 'default' | 'tinymce' | 'atto' | 'plain'
  activityChooser: boolean
  calendar: { timeFormat: 'default' | '12' | '24'; firstDay: number; maxUpcoming: number; lookaheadDays: number; rememberFilter: boolean }
  badges: { showOnProfile: boolean }
  notifDisabled: boolean
  notif: Record<string, NotifPref>
  blockOrder: BlockId[]
  hiddenBlocks: BlockId[]
  hideBlocks: boolean
  updateProfile: (p: Partial<Profile>) => void
  set: <K extends keyof PrefsState>(k: K, v: PrefsState[K]) => void
  setNotif: (key: string, p: Partial<NotifPref>) => void
  moveBlock: (id: BlockId, dir: -1 | 1) => void
  toggleBlockHidden: (id: BlockId) => void
  resetDashboard: () => void
}

const DEFAULT_ORDER: BlockId[] = ['timeline', 'calendar', 'upcoming', 'badges', 'privatefiles', 'onlineusers']

export const notifDefault: NotifPref = { webIn: true, webOut: true, emailIn: false, emailOut: true }

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      profile: { firstName: '', surname: '', emailDisplay: 'courses', city: 'Homagama', country: 'Sri Lanka', timezone: 'Asia/Colombo', description: '', interests: '', webPage: '', institution: 'Altus Vera', department: 'Faculty of Computing', phone: '', mobile: '', address: '', idNumber: '', middleName: '', alternateName: '' },
      language: 'English (en)',
      forum: { digest: 'none', autoSubscribe: true, tracking: false, markRead: true, nested: false },
      editor: 'default',
      activityChooser: true,
      calendar: { timeFormat: 'default', firstDay: 1, maxUpcoming: 10, lookaheadDays: 21, rememberFilter: true },
      badges: { showOnProfile: true },
      notifDisabled: false,
      notif: {},
      blockOrder: DEFAULT_ORDER,
      hiddenBlocks: [],
      hideBlocks: false,
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      set: (k, v) => set({ [k]: v } as Partial<PrefsState>),
      setNotif: (key, p) => set((s) => ({ notif: { ...s.notif, [key]: { ...(s.notif[key] ?? notifDefault), ...p } } })),
      moveBlock: (id, dir) => set((s) => {
        const o = [...s.blockOrder]; const i = o.indexOf(id); const j = i + dir
        if (i < 0 || j < 0 || j >= o.length) return {}
        ;[o[i], o[j]] = [o[j], o[i]]
        return { blockOrder: o }
      }),
      toggleBlockHidden: (id) => set((s) => ({ hiddenBlocks: s.hiddenBlocks.includes(id) ? s.hiddenBlocks.filter((b) => b !== id) : [...s.hiddenBlocks, id] })),
      resetDashboard: () => set({ blockOrder: DEFAULT_ORDER, hiddenBlocks: [], hideBlocks: false }),
    }),
    { name: 'lms-prefs-v1' },
  ),
)

export const BADGES = [
  { id: 1, name: 'Early Submitter', description: 'Submitted five assignments at least 24 hours before the due date.', issued: '2 weeks ago', course: 'BS401.3', color: '#0033A0' },
  { id: 2, name: 'Forum Contributor', description: 'Posted helpful replies in course discussion forums.', issued: '1 month ago', course: 'CS404.3', color: '#0D9488' },
  { id: 3, name: 'Quiz Master', description: 'Scored 90% or higher in three quizzes.', issued: '3 months ago', course: 'SE402.3', color: '#7C3AED' },
]
