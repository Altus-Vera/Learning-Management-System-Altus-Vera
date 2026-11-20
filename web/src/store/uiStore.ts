import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './authStore'

interface UiState {
  sidebarCollapsed: boolean
  viewAsStudent: boolean
  toggleSidebar: () => void
  setViewAsStudent: (v: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      viewAsStudent: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setViewAsStudent: (viewAsStudent) => set({ viewAsStudent }),
    }),
    { name: 'lms-ui' },
  ),
)

export function useRole() {
  const role = useAuthStore((s) => s.user?.role ?? 'Student')
  const viewAsStudent = useUiStore((s) => s.viewAsStudent)
  const canTeach = role === 'Lecturer' || role === 'Admin'
  return { role, canTeach, isTeacher: canTeach && !viewAsStudent }
}
