import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { Eye, EyeOff, Loader2, HelpCircle, Mail, Lock, AlertCircle, Moon, Sun, BookOpen, ClipboardCheck, CalendarDays, GraduationCap, CheckCircle2 } from 'lucide-react'
import { useLogin } from '../hooks/useLogin'
import { useAuthStore } from '../../../store/authStore'
import { useThemeStore } from '../../../store/themeStore'
import { Modal } from '../../../components/Modal'
import { BrandLogo } from '../../../components/BrandLogo'

const REMEMBER_KEY = 'lms-remember-username'

const FEATURES = [
  { icon: BookOpen, text: 'Lecture notes and course materials in one place' },
  { icon: ClipboardCheck, text: 'Submit assignments and track your status' },
  { icon: CalendarDays, text: 'Never miss a deadline with the timeline' },
  { icon: GraduationCap, text: 'View grades and lecturer feedback' },
]

export default function LoginPage() {
  const remembered = localStorage.getItem(REMEMBER_KEY) ?? ''
  const [email, setEmail] = useState(remembered)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(!!remembered)
  const [cookieHelp, setCookieHelp] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const login = useLogin()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { theme, toggleTheme } = useThemeStore()

  if (isAuthenticated()) return <Navigate to="/dashboard" replace />

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    if (remember) localStorage.setItem(REMEMBER_KEY, email)
    else localStorage.removeItem(REMEMBER_KEY)
    login.mutate({ email, password })
  }

  const error = login.isError
    ? isAxiosError(login.error) && !login.error.response
      ? 'Unable to connect to the server. Please check your connection and try again.'
      : 'Invalid login, please try again'
    : null

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg-page)' }}>
      <aside className="hidden lg:flex relative w-[46%] max-w-[680px] flex-col justify-between p-12 text-white overflow-hidden"
        style={{ background: 'linear-gradient(140deg,#001C5C 0%,#0033A0 55%,#00B3A1 120%)' }}>
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -left-20 bottom-10 w-72 h-72 rounded-full bg-white/5" />
        <svg className="absolute inset-0 w-full h-full opacity-[.12]" preserveAspectRatio="none">
          <defs><pattern id="lp" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#lp)" />
        </svg>

        <div className="relative">
          <BrandLogo variant="full" white height={128} />
        </div>

        <div className="relative">
          <h1 className="!text-white text-4xl xl:text-5xl font-extrabold leading-tight">Welcome to<br />Altus Vera LMS</h1>
          <p className="text-white/80 mt-4 text-lg max-w-md">Everything you need for your studies, from lectures to grades, in one simple place.</p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center shrink-0"><Icon size={19} /></span>
                <span className="text-white/90 font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-white/60">© {new Date().getFullYear()} Altus Vera Learning Management System</div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-5 lg:justify-end">
          <div className="flex items-center gap-2.5 lg:hidden"><BrandLogo height={36} /><span className="font-extrabold tracking-[0.06em]" style={{ color: 'var(--color-primary)' }}>ALTUS VERA</span></div>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
        </div>

        <div className="flex-1 grid place-items-center px-5 pb-10">
          <div className="w-full max-w-[420px] animate-in">
            <h2 className="text-3xl font-bold">Log in</h2>
            <p className="muted mt-1.5 mb-8">Sign in with your Altus Vera account to continue.</p>

            {error && (
              <div role="alert" className="flex items-start gap-3 p-3.5 mb-5 rounded-xl text-sm font-medium" style={{ background: 'var(--color-red-soft)', color: 'var(--color-red)' }}>
                <AlertCircle size={18} className="shrink-0 mt-px" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="form-label">Email address</label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" />
                  <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@altusvera.lk" required autoFocus={!remembered} className="form-control !h-12 pl-11" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="form-label">Password</label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" />
                  <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required autoFocus={!!remembered} className="form-control !h-12 pl-11 pr-12" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn !w-9 !h-9" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--color-heading)' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
                  Remember username
                </label>
                <button type="button" onClick={() => { setForgotEmail(email); setForgotSent(false); setForgotOpen(true) }} className="text-sm font-semibold" style={{ color: 'var(--color-link)' }}>
                  Forgotten your password?
                </button>
              </div>

              <button type="submit" disabled={login.isPending} className="btn btn-primary w-full !h-12 !text-[15px]">
                {login.isPending ? <><Loader2 size={18} className="animate-spin" /> Logging in…</> : 'Log in'}
              </button>
            </form>

            <div className="relative mt-5 flex items-center justify-center gap-1.5 text-sm muted">
              Cookies must be enabled in your browser
              <button type="button" onClick={() => setCookieHelp((v) => !v)} aria-label="Help with cookies" style={{ color: 'var(--color-link)' }}><HelpCircle size={15} /></button>
              {cookieHelp && (
                <div className="dropdown-menu top-7 w-72 p-3.5 text-xs leading-relaxed" style={{ color: 'var(--color-text)' }}>
                  Two cookies are used on this site: one keeps you logged in between pages, and the other remembers your username. Both are deleted when you log out or close the browser.
                </div>
              )}
            </div>

            <div className="mt-8 p-5 rounded-2xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <h3 className="font-bold text-[15px] mb-2">Your login instructions</h3>
              <p className="text-sm leading-relaxed">For the username, please use your <b style={{ color: 'var(--color-heading)' }}>Altus Vera email address</b>.</p>
              <p className="text-sm leading-relaxed mt-2">For further queries, contact IT Support at <a href="mailto:support@altusvera.lk" className="font-semibold">support@altusvera.lk</a>.</p>
            </div>

            <p className="lg:hidden text-center text-xs muted mt-8">© {new Date().getFullYear()} Altus Vera Learning Management System</p>
          </div>
        </div>
      </main>

      <Modal open={forgotOpen} title="Forgotten password" onClose={() => setForgotOpen(false)}
        footer={forgotSent
          ? <button className="btn btn-primary" onClick={() => setForgotOpen(false)}>Continue</button>
          : <><button className="btn btn-secondary" onClick={() => setForgotOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={!/\S+@\S+\.\S+/.test(forgotEmail)} onClick={() => setForgotSent(true)}>Search</button></>}>
        {forgotSent ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="shrink-0" style={{ color: 'var(--color-green)' }} />
            <p className="text-sm leading-relaxed">If you supplied a correct email address, an email will be sent to you with instructions on how to reset your password. If you continue to have difficulty, please contact the site administrator.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">To reset your password, enter your email address below. If we can find you in the database, an email will be sent with instructions on how to get access again.</p>
            <input type="email" className="form-control" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="Email address" autoFocus />
          </div>
        )}
      </Modal>
    </div>
  )
}
