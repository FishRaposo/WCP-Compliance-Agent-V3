import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Shield, AlertTriangle } from 'lucide-react'
import { Layer1Panel } from './Layer1Panel'
import { Layer2Panel } from './Layer2Panel'
import { Layer3Panel } from './Layer3Panel'
import type { AnalysisResult, AuditEvent } from '../types'

interface Props {
  result: AnalysisResult
  isMockMode: boolean
}

function FinalStatusBanner({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Approved: {
      bg: 'bg-emerald-900/30 border-emerald-700',
      text: 'text-emerald-300',
      icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    },
    Revise: {
      bg: 'bg-amber-900/30 border-amber-700',
      text: 'text-amber-300',
      icon: <Clock className="w-5 h-5 text-amber-400" />,
    },
    Reject: {
      bg: 'bg-red-900/30 border-red-700',
      text: 'text-red-300',
      icon: <XCircle className="w-5 h-5 text-red-400" />,
    },
    'Pending Human Review': {
      bg: 'bg-violet-900/30 border-violet-700',
      text: 'text-violet-300',
      icon: <Shield className="w-5 h-5 text-violet-400" />,
    },
  }
  const style = map[status] ?? map['Revise']
  return (
    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${style.bg}`}>
      {style.icon}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">Final Decision</div>
        <div className={`text-lg font-bold ${style.text}`}>{status}</div>
      </div>
    </div>
  )
}

function DecisionNarrativeCard({ auditTrail, finalStatus }: { auditTrail: AuditEvent[]; finalStatus: string }) {
  const finalizedEvent = auditTrail.find(e => e.event === 'finalized')
  const explanation = finalizedEvent?.details?.decisionExplanation as string | undefined
  if (!explanation) return null

  const isHumanReview = finalStatus === 'Pending Human Review'
  const isRejected = finalStatus === 'Reject'

  return (
    <div className={`rounded-xl border px-5 py-4 space-y-1.5 ${
      isHumanReview
        ? 'bg-violet-950/20 border-violet-800'
        : isRejected
        ? 'bg-red-950/20 border-red-800'
        : 'bg-slate-900/50 border-slate-700'
    }`}>
      <div className="flex items-center gap-2">
        {isHumanReview
          ? <AlertTriangle className="w-4 h-4 text-violet-400 shrink-0" />
          : <Shield className="w-4 h-4 text-slate-500 shrink-0" />
        }
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Decision Explanation</span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{explanation}</p>
    </div>
  )
}

interface PanelProps {
  title: string
  subtitle: string
  badge?: string
  badgeColor?: string
  index: number
  visible: boolean
  children: React.ReactNode
}

function CollapsiblePanel({ title, subtitle, badge, badgeColor, index, visible, children }: PanelProps) {
  const [open, setOpen] = useState(true)

  if (!visible) return null

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-900/60 border border-violet-800 flex items-center justify-center text-xs font-bold text-violet-300">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeColor ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            {badge}
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-800">
          {children}
        </div>
      )}
    </div>
  )
}

function AuditEventDetails({ entry }: { entry: AuditEvent }) {
  const details = entry.details
  if (!details) return null

  if (entry.event === 'llm_reasoning') {
    const rationale = details.rationale as string | undefined
    const reasoningTrace = details.reasoningTrace as string | undefined
    return (
      <div className="pl-4 space-y-1 mt-0.5">
        {rationale && (
          <p className="text-[10px] text-slate-500 leading-relaxed">
            <span className="text-slate-600 font-medium">Rationale:</span> {rationale}
          </p>
        )}
        {reasoningTrace && reasoningTrace !== rationale && (
          <p className="text-[10px] text-slate-600 leading-relaxed font-mono">
            <span className="text-slate-700 font-medium">Trace:</span> {reasoningTrace}
          </p>
        )}
      </div>
    )
  }

  if (entry.event === 'check_completed' && entry.stage === 'layer1') {
    const failedChecks = details.failedChecks as Array<{ id: string; severity: string; message: string }> | undefined
    if (!failedChecks || failedChecks.length === 0) return null
    return (
      <div className="pl-4 mt-0.5 space-y-0.5">
        {failedChecks.map(c => (
          <p key={c.id} className="text-[10px] text-red-500/80 leading-relaxed">
            <span className="font-mono">{c.id}</span>
            <span className="text-slate-600 mx-1">·</span>
            <span className="text-red-600/60">[{c.severity}]</span>
            <span className="text-slate-600 mx-1">·</span>
            {c.message}
          </p>
        ))}
      </div>
    )
  }

  if (entry.event === 'trust_computed') {
    const reasons = details.reasons as string[] | undefined
    if (!reasons || reasons.length === 0) return null
    return (
      <div className="pl-4 mt-0.5">
        <p className="text-[10px] text-slate-600 leading-relaxed">{reasons.join(' • ')}</p>
      </div>
    )
  }

  if (entry.event === 'finalized') {
    const explanation = details.decisionExplanation as string | undefined
    if (!explanation) return null
    return (
      <div className="pl-4 mt-0.5">
        <p className="text-[10px] text-slate-500 leading-relaxed">{explanation}</p>
      </div>
    )
  }

  return null
}

export function PipelineVisualizer({ result, isMockMode }: Props) {
  const [visiblePanels, setVisiblePanels] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setVisiblePanels(1), 50)
    const t2 = setTimeout(() => setVisiblePanels(2), 200)
    const t3 = setTimeout(() => setVisiblePanels(3), 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      setVisiblePanels(0)
    }
  }, [result])

  const failCount = result.deterministic.checks.filter(c => !c.passed).length
  const trustPct = Math.round(result.trust.score * 100)
  const trustColor =
    result.trust.band === 'auto'
      ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
      : result.trust.band === 'flag_for_review'
      ? 'bg-amber-900/50 text-amber-300 border-amber-700'
      : 'bg-red-900/50 text-red-300 border-red-700'

  return (
    <div className="space-y-4">
      {/* Final status */}
      <FinalStatusBanner status={result.finalStatus} />

      {/* Trace ID */}
      {result.traceId && (
        <div className="text-[11px] text-slate-600 font-mono">
          trace: {result.traceId} · {result.timestamp ? new Date(result.timestamp).toLocaleString() : ''}
        </div>
      )}

      {/* Decision narrative — shown as soon as results are available */}
      {result.auditTrail && (
        <DecisionNarrativeCard auditTrail={result.auditTrail} finalStatus={result.finalStatus} />
      )}

      {/* Layer 1 */}
      <CollapsiblePanel
        index={1}
        title="Layer 1 — Deterministic"
        subtitle="Extraction, DBWD rate lookup, rule checks — no LLM"
        badge={failCount === 0 ? 'All passed' : `${failCount} failed`}
        badgeColor={failCount === 0
          ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
          : 'bg-red-900/50 text-red-300 border-red-700'
        }
        visible={visiblePanels >= 1}
      >
        <Layer1Panel data={result.deterministic} />
      </CollapsiblePanel>

      {/* Layer 2 */}
      <CollapsiblePanel
        index={2}
        title="Layer 2 — LLM Verdict"
        subtitle="Constrained LLM reasoning — cites Layer 1 check IDs only"
        badge={result.verdict.status}
        badgeColor={
          result.verdict.status === 'Approved'
            ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
            : result.verdict.status === 'Reject'
            ? 'bg-red-900/50 text-red-300 border-red-700'
            : 'bg-amber-900/50 text-amber-300 border-amber-700'
        }
        visible={visiblePanels >= 2}
      >
        <Layer2Panel data={result.verdict} isMockMode={isMockMode} />
      </CollapsiblePanel>

      {/* Layer 3 */}
      <CollapsiblePanel
        index={3}
        title="Layer 3 — Trust Score"
        subtitle="Weighted confidence routing — below 0.60 triggers human review"
        badge={`${trustPct}%`}
        badgeColor={trustColor}
        visible={visiblePanels >= 3}
      >
        <Layer3Panel trust={result.trust} humanReview={result.humanReview} />
      </CollapsiblePanel>

      {/* Audit trail */}
      {result.auditTrail && result.auditTrail.length > 0 && visiblePanels >= 3 && (
        <details className="group">
          <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition-colors list-none flex items-center gap-1.5">
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            Audit trail ({result.auditTrail.length} events)
          </summary>
          <div className="mt-2 space-y-2 pl-4 border-l border-slate-800">
            {result.auditTrail.map((entry, i) => (
              <div key={i} className="space-y-0.5">
                <div className="text-[11px] font-mono text-slate-600">
                  <span className="text-slate-500">[{entry.stage}]</span> {entry.event}
                  {entry.timestamp && (
                    <span className="text-slate-700 ml-2">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  )}
                </div>
                <AuditEventDetails entry={entry} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
