import { Link } from 'react-router-dom'
import { ShieldAlert, HeartPulse, ChevronRight } from 'lucide-react'
import { useAtRisk, useMyInsights, LEVEL_TONE } from './insightsApi'
import { RiskBar } from './InsightsPage'

export function AttentionCard() {
  const { data, isLoading } = useAtRisk()
  const top = (data?.students ?? []).filter((s) => s.level !== 'Low').slice(0, 5)
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2"><ShieldAlert size={18} style={{ color: 'var(--color-red)' }} /> Students needing attention</h2>
        <Link to="/insights" className="text-sm font-semibold flex items-center">View all <ChevronRight size={15} /></Link>
      </div>
      {isLoading ? <p className="text-sm muted">Analysing…</p> : top.length === 0 ? <p className="text-sm muted">No students are currently at risk. 🎉</p> : (
        <div className="space-y-3">
          {top.map((s) => (
            <Link key={`${s.studentId}:${s.courseId}`} to="/insights" className="flex items-center gap-3 !text-inherit">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--color-heading)' }}>{s.name} <span className="muted font-normal">· {s.courseName.split('-')[0]}</span></div>
                <div className="text-xs muted truncate">{s.reasons[0]}</div>
              </div>
              <RiskBar score={s.riskScore} level={s.level} />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export function HealthCard() {
  const { data } = useMyInsights()
  if (!data) return null
  const tone = LEVEL_TONE[data.level]
  return (
    <Link to="/insights/me" className="card p-5 flex items-center gap-4 !text-inherit hover:-translate-y-0.5 transition-transform">
      <span className="w-12 h-12 rounded-2xl grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone.color} 14%, transparent)`, color: tone.color }}><HeartPulse size={22} /></span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium muted">My academic health</div>
        <div className="font-bold" style={{ color: tone.color }}>{data.level === 'Low' ? 'On track' : data.level === 'Medium' ? 'Some concerns' : 'Needs attention'}</div>
        <div className="text-xs muted truncate">{data.tips[0]}</div>
      </div>
      <ChevronRight size={18} className="muted" />
    </Link>
  )
}
