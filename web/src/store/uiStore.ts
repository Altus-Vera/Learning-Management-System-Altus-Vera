import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './authStore'

interface UiState {
  sidebarCollapsed: boolean
  viewAsStudent: boolean
  messages: { open: boolean; startWith: string | null }
  toggleSidebar: () => void
  setViewAsStudent: (v: boolean) => void
  openMessages: (startWith?: string | null) => void
  closeMessages: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      viewAsStudent: false,
      messages: { open: false, startWith: null },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setViewAsStudent: (viewAsStudent) => set({ viewAsStudent }),
      openMessages: (startWith = null) => set({ messages: { open: true, startWith } }),
      closeMessages: () => set({ messages: { open: false, startWith: null } }),
    }),
    { name: 'lms-ui', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, viewAsStudent: s.viewAsStudent }) },
  ),
)

export function useRole() {
  const role = useAuthStore((s) => s.user?.role ?? 'Student')
  const viewAsStudent = useUiStore((s) => s.viewAsStudent)
  const canTeach = role === 'Lecturer' || role === 'Admin'
  return { role, canTeach, isTeacher: canTeach && !viewAsStudent }
}
