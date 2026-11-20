import { create } from 'zustand'
import { api } from '../services/api'
import { call } from '../services/sync'

export interface Person { id: string; name: string; role: 'Student' | 'Lecturer' }
export interface Message { id: number; from: string; text: string; at: string }
export interface Conversation { id: number; type: 'private' | 'group'; name: string; members: string[]; starred: boolean; muted: boolean; unread: number; messages: Message[] }
export interface Notification { id: number; subject: string; text: string; link: string; at: string; read: boolean; component: string }

/** Everyone the signed-in user can message; filled from the server on every data load. */
export const PEOPLE: Person[] = []
export const personName = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? 'Unknown user'

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
  startPrivate: (me: string, other: string) => Promise<number | undefined>
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
  markNotificationRead: (id: number) => void
  markAllNotificationsRead: () => void
}

const contact = (id: string, action: string) => call(() => api.post(`/api/v1/contacts/${id}/${action}`))

export const useSocialStore = create<SocialState>()((set, get) => ({
  conversations: [],
  contacts: [],
  requests: [],
  sentRequests: [],
  blocked: [],
  notifications: [],
  privacy: 'courses',
  enterToSend: true,
  send: (convId, from, text) => {
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, { id: -Date.now(), from, text, at: new Date().toISOString() }] } : c)) }))
    void call(() => api.post(`/api/v1/conversations/${convId}/messages`, { text }))
  },
  startPrivate: async (_me, other) => {
    const res = await call(() => api.post<{ id: number }>('/api/v1/conversations', { userId: other }))
    return res?.data.id
  },
  markConvRead: (id) => {
    if (!get().conversations.find((c) => c.id === id)?.unread) return
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) }))
    void call(() => api.put(`/api/v1/conversations/${id}/member`, { markRead: true }), { reload: false })
  },
  toggleStar: (id) => {
    const starred = !get().conversations.find((c) => c.id === id)?.starred
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, starred } : c)) }))
    void call(() => api.put(`/api/v1/conversations/${id}/member`, { starred, markRead: false }), { reload: false })
  },
  toggleMute: (id) => {
    const muted = !get().conversations.find((c) => c.id === id)?.muted
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, muted } : c)) }))
    void call(() => api.put(`/api/v1/conversations/${id}/member`, { muted, markRead: false }), { reload: false })
  },
  deleteMessages: (id, ids) => {
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, messages: c.messages.filter((m) => !ids.includes(m.id)) } : c)) }))
    void call(() => api.post(`/api/v1/conversations/${id}/delete-messages`, { messageIds: ids }))
  },
  deleteConversation: (id) => {
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }))
    void call(() => api.delete(`/api/v1/conversations/${id}`))
  },
  addContact: (id) => { set((s) => ({ sentRequests: [...new Set([...s.sentRequests, id])] })); void contact(id, 'request') },
  removeContact: (id) => { set((s) => ({ contacts: s.contacts.filter((c) => c !== id) })); void contact(id, 'remove') },
  acceptRequest: (id) => { set((s) => ({ contacts: [...new Set([...s.contacts, id])], requests: s.requests.filter((r) => r !== id) })); void contact(id, 'accept') },
  declineRequest: (id) => { set((s) => ({ requests: s.requests.filter((r) => r !== id) })); void contact(id, 'decline') },
  block: (id) => { set((s) => ({ blocked: [...new Set([...s.blocked, id])] })); void contact(id, 'block') },
  unblock: (id) => { set((s) => ({ blocked: s.blocked.filter((b) => b !== id) })); void contact(id, 'unblock') },
  setPrivacy: (privacy) => set({ privacy }),
  setEnterToSend: (enterToSend) => set({ enterToSend }),
  markNotificationRead: (id) => {
    if (get().notifications.find((n) => n.id === id)?.read) return
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }))
    void call(() => api.put(`/api/v1/notifications/${id}/read`), { reload: false })
  },
  markAllNotificationsRead: () => {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
    void call(() => api.put('/api/v1/notifications/read-all'), { reload: false })
  },
}))
