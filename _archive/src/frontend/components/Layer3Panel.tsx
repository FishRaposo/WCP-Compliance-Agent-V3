import { Shield, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react'
import type { TrustScore, HumanReview } from '../types'

const HUMAN_REVIEW_STATUS_LABELS: Record<string, string> = {
  not_required: 'Not required',
  pending:      'Pending review',
  approved:     'Approved by reviewer',
  rejected:     'Rejected by reviewer',
}

interface Props {
  trust: TrustScore
  humanReview?: HumanReview
}

function TrustGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.85 ? '#10b981' : score >= 0.60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>
          {pct}<span className="text-lg text-slate-500">%</span>
        </span>
        <div className="text-right text-xs text-slate-500">
          <div>≥85% auto-approve</div>
          <div>≥60% flag for review</div>
          <div>&lt;60% require human</div>
        </div>
      </div>
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden relative">
        {/* threshold markers */}
        <div className="absolute top-0 bottom-0 w-px bg-amber-600/60" style={{ left: '60%' }} />
        <div className="absolute top-0 bottom-0 w-px bg-emerald-600/60" style={{ left: '85%' }} />
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function BandBadge({ band }: { band: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    auto: { label: 'Auto-Approved', cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700' },
    flag_for_review: { label: 'Flagged for Review', cls: 'bg-amber-900/50 text-amber-300 border-amber-700' },
    require_human: { label: 'Requires Human Review', cls: 'bg-red-900/50 text-red-300 border-red-700' },
  }
  const { label, cls } = map[band] ?? { label: band, cls: 'bg-slate-800 text-slate-400 border-slate-700' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>{label}</span>
  )
}

export function Layer3Panel({ trust, humanReview }: Props) {
  const components = trust.components

  return (
    <div className="space-y-4">
      {/* Score gauge */}
      <TrustGauge score={trust.score} />

      {/* Band */}
      <div className="flex items-center gap-3 flex-wrap">
        <Shield className="w-4 h-4 text-slate-500" />
        <BandBadge band={trust.band} />
      </div>

      {/* Score components */}
      {components && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 space-y-2">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Score breakdown</p>
          {Object.entries(components).map(([key, val]) => {
            const pct = Math.round((val ?? 0) * 100)
            const labels: Record<string, string> = {
              deterministic: 'Deterministic',
              classification: 'Classification',
              llmSelf: 'LLM Self-Confidence',
              agreement: 'LLM/Det. Agreement',
            }
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{labels[key] ?? key}</span>
                  <span className="font-mono text-slate-300">{pct}%</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Trust reasons */}
      {(trust.reasons?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider">Reasons</p>
          {(trust.reasons ?? []).map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <span className="text-slate-600 mt-0.5">·</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Human review */}
      {humanReview && (
        <div className={`flex items-start gap-3 rounded-lg border p-3 ${
          humanReview.required
            ? 'bg-red-950/20 border-red-900'
            : 'bg-emerald-950/10 border-emerald-900/40'
        }`}>
          {humanReview.required
            ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            : <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          }
          <div className="text-xs space-y-1">
            <div className="font-medium text-slate-200">
              {humanReview.required ? 'Human review required' : 'No human review needed'}
            </div>
            {humanReview.status && humanReview.status !== 'not_required' && (
              <div className="text-slate-400">
                Status: <span className="font-mono text-slate-300">{HUMAN_REVIEW_STATUS_LABELS[humanReview.status] ?? humanReview.status}</span>
              </div>
            )}
            {humanReview.queuedAt && (
              <div className="text-slate-500">
                Queued: {new Date(humanReview.queuedAt).toLocaleString()}
              </div>
            )}
          </div>
          {humanReview.required && (
            <UserCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5 ml-auto" />
          )}
        </div>
      )}
    </div>
  )
}
