import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Person { id: string; name: string; role: 'Student' | 'Lecturer' }
export interface Message { id: number; from: string; text: string; at: string }
export interface Conversation { id: number; type: 'private' | 'group'; name: string; members: string[]; starred: boolean; muted: boolean; unread: number; messages: Message[] }
export interface Notification { id: number; subject: string; text: string; link: string; at: string; read: boolean; component: string }

export const PEOPLE: Person[] = [
  { id: 'l1', name: 'Dr. K. Perera', role: 'Lecturer' },
  { id: 'l2', name: 'Mr. S. Fernando', role: 'Lecturer' },
  { id: 's1', name: 'DVD Silva', role: 'Student' },
  { id: 's2', name: 'GPAD Nilwala', role: 'Student' },
  { id: 's3', name: 'KWKS Wijerathna', role: 'Student' },
  { id: 's4', name: 'TDJ Pathirana', role: 'Student' },
  { id: 's5', name: 'HN Kanakarathne', role: 'Student' },
  { id: 's6', name: 'MAS Perera', role: 'Student' },
]
export const personName = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? 'Unknown user'

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString()

const seedConversations = (): Conversation[] => [
  { id: 1, type: 'group', name: 'BS401.3 — Group A', members: ['s1', 's2', 's3', 's4'], starred: true, muted: false, unread: 2, messages: [
    { id: 1, from: 's2', text: 'Hi all, shall we meet tomorrow to finish the slides?', at: ago(300) },
    { id: 2, from: 's1', text: 'Yes, 10 AM at the library works for me.', at: ago(280) },
    { id: 3, from: 's3', text: 'I will bring the financial analysis section.', at: ago(60) },
    { id: 4, from: 's4', text: 'Great, see you there 👍', at: ago(45) },
  ] },
  { id: 2, type: 'private', name: '', members: ['s1', 'l1'], starred: false, muted: false, unread: 1, messages: [
    { id: 5, from: 's1', text: 'Good morning sir, could I get an extension for Tutorial 08? I was ill last week.', at: ago(1500) },
    { id: 6, from: 'l1', text: 'Please submit a medical certificate to the faculty office and I will grant a 3-day extension.', at: ago(1400) },
  ] },
  { id: 3, type: 'private', name: '', members: ['s1', 's5'], starred: false, muted: false, unread: 0, messages: [
    { id: 7, from: 's5', text: 'Did you download the past papers?', at: ago(4000) },
    { id: 8, from: 's1', text: 'Yes, they are in the Quizzes section folder.', at: ago(3990) },
  ] },
]

const seedNotifications = (): Notification[] => [
  { id: 1, component: 'Assignment', subject: 'Tutorial 06 has been graded', text: 'Your submission for Tutorial 06 has been graded. View the feedback in the assignment.', link: '/grades', at: ago(90), read: false },
  { id: 2, component: 'Forum', subject: 'New post: Lecture rescheduled to Friday', text: 'Module Lecturer posted in Announcements: This week’s lecture will be held on Friday.', link: '/dashboard', at: ago(2880), read: false },
  { id: 3, component: 'Assignment', subject: 'Submission received', text: 'You have submitted Assignment Presentation Slides.', link: '/dashboard', at: ago(4320), read: true },
  { id: 4, component: 'System', subject: 'You earned a badge: Early Submitter', text: 'Congratulations! You have been awarded the badge “Early Submitter”.', link: '/badges', at: ago(10080), read: true },
]

interface SocialState {
  conversations: Conversation[]
  contacts: string[]
  requests: string[]
  sentRequests: string[]
  blocked: string[]
  notifications: Notification[]
  privacy: 'contacts' | 'courses'
  enterToSend: boolean
  send: (convId: number, from: string, text: string) => void
  startPrivate: (me: string, other: string) => number
  markConvRead: (convId: number) => void
  toggleStar: (convId: number) => void
  toggleMute: (convId: number) => void
  deleteMessages: (convId: number, ids: number[]) => void
  deleteConversation: (convId: number) => void
  addContact: (id: string) => void
  removeContact: (id: string) => void
  acceptRequest: (id: string) => void
  declineRequest: (id: string) => void
  block: (id: string) => void
  unblock: (id: string) => void
  setPrivacy: (p: 'contacts' | 'courses') => void
  setEnterToSend: (v: boolean) => void
  pushNotification: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void
  markNotificationRead: (id: number) => void
  markAllNotificationsRead: () => void
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      conversations: seedConversations(),
      contacts: ['s2', 's3'],
      requests: ['s6'],
      sentRequests: [],
      blocked: [],
      notifications: seedNotifications(),
      privacy: 'courses',
      enterToSend: true,
      send: (convId, from, text) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, { id: Date.now(), from, text, at: new Date().toISOString() }] } : c)) })),
      startPrivate: (me, other) => {
        const existing = get().conversations.find((c) => c.type === 'private' && c.members.includes(me) && c.members.includes(other))
        if (existing) return existing.id
        const id = Date.now()
        set((s) => ({ conversations: [{ id, type: 'private', name: '', members: [me, other], starred: false, muted: false, unread: 0, messages: [] }, ...s.conversations] }))
        return id
      },
      markConvRead: (id) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) })),
      toggleStar: (id) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c)) })),
      toggleMute: (id) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, muted: !c.muted } : c)) })),
      deleteMessages: (id, ids) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, messages: c.messages.filter((m) => !ids.includes(m.id)) } : c)) })),
      deleteConversation: (id) => set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),
      addContact: (id) => set((s) => ({ sentRequests: [...new Set([...s.sentRequests, id])] })),
      removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c !== id) })),
      acceptRequest: (id) => set((s) => ({ contacts: [...new Set([...s.contacts, id])], requests: s.requests.filter((r) => r !== id) })),
      declineRequest: (id) => set((s) => ({ requests: s.requests.filter((r) => r !== id) })),
      block: (id) => set((s) => ({ blocked: [...new Set([...s.blocked, id])] })),
      unblock: (id) => set((s) => ({ blocked: s.blocked.filter((b) => b !== id) })),
      setPrivacy: (privacy) => set({ privacy }),
      setEnterToSend: (enterToSend) => set({ enterToSend }),
      pushNotification: (n) => set((s) => ({ notifications: [{ ...n, id: Date.now(), at: new Date().toISOString(), read: false }, ...s.notifications] })),
      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    }),
    { name: 'lms-social-v1' },
  ),
)
