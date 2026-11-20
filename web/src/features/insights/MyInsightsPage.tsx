import { Link } from 'react-router-dom'
import { HeartPulse, Lightbulb, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { useMyInsights, LEVEL_TONE } from './insightsApi'
import { errorMessage } from '../../services/sync'

const LABEL = { High: 'Needs attention', Medium: 'Some concerns', Low: 'On track' } as const

export default function MyInsightsPage() {
  const { data, isLoading, error, refetch, isFetching } = useMyInsights()
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end gap-3">
        <div className="mr-auto"><h1 className="text-2xl font-bold">My progress</h1><p className="text-sm muted">An overview of how you are doing in each module, with tips to improve.</p></div>
        <button className="btn btn-secondary" onClick={() => void refetch()} disabled={isFetching}><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> Refresh</button>
      </div>
      {isLoading ? <div className="card p-12 text-center muted">Loading your progress…</div> : error ? <div className="card p-10 text-center"><p>{errorMessage(error)}</p></div> : data && (
        <>
          <div className="card p-6 flex flex-wrap items-center gap-6">
            <span className="w-16 h-16 rounded-2xl grid place-items-center" style={{ background: `color-mix(in srgb, ${LEVEL_TONE[data.level].color} 14%, transparent)`, color: LEVEL_TONE[data.level].color }}><HeartPulse size={30} /></span>
            <div className="flex-1 min-w-[200px]">
              <div className="text-sm muted">Overall academic health</div>
              <div className="text-2xl font-bold" style={{ color: LEVEL_TONE[data.level].color }}>{LABEL[data.level]}</div>
            </div>
            <div className="w-full sm:w-64">
              <div className="flex justify-between text-xs muted mb-1"><span>Risk score</span><span className="font-bold" style={{ color: LEVEL_TONE[data.level].color }}>{data.riskScore}/100</span></div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-subtle)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(4, data.riskScore)}%`, background: LEVEL_TONE[data.level].color }} /></div>
            </div>
          </div>
          <section className="card p-6">
            <h2 className="font-bold flex items-center gap-2 mb-3"><Lightbulb size={18} style={{ color: 'var(--color-amber)' }} /> Tips for you</h2>
            <ul className="space-y-2">{data.tips.map((t) => <li key={t} className="text-sm flex gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />{t}</li>)}</ul>
          </section>
          <div className="grid md:grid-cols-2 gap-5">
            {data.courses.map((c) => (
              <Link key={c.courseId} to={`/courses/${c.courseId}`} className="card p-5 !text-inherit hover:-translate-y-0.5 transition-transform">
                <div className="flex items-start gap-3 mb-3"><div className="flex-1 font-semibold" style={{ color: 'var(--color-heading)' }}>{c.courseName}</div><span className={`badge ${LEVEL_TONE[c.level].badge}`}>{LABEL[c.level]}</span></div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm mb-3">
                  <div><div className="font-bold" style={{ color: 'var(--color-heading)' }}>{c.avgGrade ?? '-'}{c.avgGrade !== null && '%'}</div><div className="text-[11px] muted">Avg grade</div></div>
                  <div><div className="font-bold" style={{ color: c.missing ? 'var(--color-red)' : 'var(--color-heading)' }}>{c.missing}</div><div className="text-[11px] muted">Missing</div></div>
                  <div><div className="font-bold" style={{ color: 'var(--color-heading)' }}>{c.quizAvg ?? '-'}{c.quizAvg !== null && '%'}</div><div className="text-[11px] muted">Quiz avg</div></div>
                  <div><div className="font-bold" style={{ color: 'var(--color-heading)' }}>{c.completion}%</div><div className="text-[11px] muted">Complete</div></div>
                </div>
                <ul className="space-y-1">{c.reasons.slice(0, 3).map((r) => <li key={r} className="text-xs flex gap-1.5 muted">{c.level === 'Low' ? <CheckCircle2 size={13} className="shrink-0 mt-px" style={{ color: 'var(--color-green)' }} /> : <AlertTriangle size={13} className="shrink-0 mt-px" style={{ color: LEVEL_TONE[c.level].color }} />}{r}</li>)}</ul>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
