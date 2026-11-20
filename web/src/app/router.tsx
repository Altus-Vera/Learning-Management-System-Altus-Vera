import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { AppShell } from '../components/layout/AppShell'

const LoginPage     = lazy(() => import('../features/auth/components/LoginPage'))
const DashboardPage = lazy(() => import('../features/dashboard/components/DashboardPage'))
const CoursePage    = lazy(() => import('../features/courses/components/CoursePage').then((m) => ({ default: m.CoursePage })))
const ModPage       = lazy(() => import('../features/courses/components/ModPage'))
const AssignPage    = lazy(() => import('../features/assign/components/AssignPage'))
const GradesPage    = lazy(() => import('../features/grades/components/GradesPage'))
const CalendarPage  = lazy(() => import('../features/calendar/components/CalendarPage'))
const CoursesPage   = lazy(() => import('../features/misc/pages').then((m) => ({ default: m.CoursesPage })))
const SiteHomePage  = lazy(() => import('../features/misc/pages').then((m) => ({ default: m.SiteHomePage })))
const ProfilePage   = lazy(() => import('../features/user/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const BadgesPage    = lazy(() => import('../features/user/ProfilePage').then((m) => ({ default: m.BadgesPage })))
const SearchPage    = lazy(() => import('../features/user/ProfilePage').then((m) => ({ default: m.CourseSearchPage })))
const adminPage = (name: 'AdminOverview' | 'AdminStudents' | 'AdminPayments' | 'AdminEnrolment' | 'AdminSubmissions' | 'AdminAudit') => lazy(() => import('../features/admin/AdminPages').then((m) => ({ default: m[name] })))
const AdminOverview = adminPage('AdminOverview')
const AdminStudents = adminPage('AdminStudents')
const AdminPayments = adminPage('AdminPayments')
const AdminEnrolment = adminPage('AdminEnrolment')
const AdminSubmissions = adminPage('AdminSubmissions')
const AdminAudit = adminPage('AdminAudit')
const NotificationsPage = lazy(() => import('../features/user/NotificationsPage'))
const PrefsHub      = lazy(() => import('../features/user/PreferencesPages').then((m) => ({ default: m.PreferencesHub })))
const PrefsSection  = lazy(() => import('../features/user/PreferencesPages').then((m) => ({ default: m.PreferencesSection })))
const FilesPage     = lazy(() => import('../features/misc/pages').then((m) => ({ default: m.FilesPage })))
const InfoPage      = lazy(() => import('../features/misc/pages').then((m) => ({ default: m.InfoPage })))

function Loading() {
  return (
    <div className="min-h-[50vh] grid place-items-center">
      <div className="w-8 h-8 rounded-full border-[3px] animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
    </div>
  )
}

const s = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>

export const router = createBrowserRouter([
  { path: '/login', element: s(<LoginPage />) },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: s(<DashboardPage />) },
      { path: '/home', element: s(<SiteHomePage />) },
      { path: '/courses', element: s(<CoursesPage />) },
      { path: '/courses/:courseId', element: s(<CoursePage />) },
      { path: '/courses/:courseId/assign/:activityId', element: s(<AssignPage />) },
      { path: '/courses/:courseId/mod/:activityId', element: s(<ModPage />) },
      { path: '/grades', element: s(<GradesPage />) },
      { path: '/grades/:courseId', element: <Navigate to="/grades" replace /> },
      { path: '/calendar', element: s(<CalendarPage />) },
      { path: '/profile', element: s(<ProfilePage />) },
      { path: '/user/:userId', element: s(<ProfilePage />) },
      { path: '/badges', element: s(<BadgesPage />) },
      { path: '/search', element: s(<SearchPage />) },
      { path: '/notifications', element: s(<NotificationsPage />) },
      { path: '/admin', element: s(<AdminOverview />) },
      { path: '/admin/students', element: s(<AdminStudents />) },
      { path: '/admin/payments', element: s(<AdminPayments />) },
      { path: '/admin/enrolment', element: s(<AdminEnrolment />) },
      { path: '/admin/submissions', element: s(<AdminSubmissions />) },
      { path: '/admin/audit', element: s(<AdminAudit />) },
      { path: '/preferences', element: s(<PrefsHub />) },
      { path: '/preferences/:section', element: s(<PrefsSection />) },
      { path: '/files', element: s(<FilesPage />) },
      { path: '/page/:slug', element: s(<InfoPage />) },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
