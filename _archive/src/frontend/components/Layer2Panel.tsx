import { Brain, FileText, Hash, Cpu } from 'lucide-react'
import type { LLMVerdict } from '../types'

interface Props {
  data: LLMVerdict
  isMockMode: boolean
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Approved: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
    Revise:   'bg-amber-900/50 text-amber-300 border-amber-700',
    Reject:   'bg-red-900/50 text-red-300 border-red-700',
    'Pending Human Review': 'bg-violet-900/50 text-violet-300 border-violet-700',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${map[status] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {status}
    </span>
  )
}

export function Layer2Panel({ data, isMockMode }: Props) {
  const confPct = data.selfConfidence != null ? Math.round(data.selfConfidence * 100) : null

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={data.status} />
        {isMockMode && (
          <span className="text-[10px] font-mono bg-amber-950/40 text-amber-400 border border-amber-800 px-2 py-0.5 rounded">
            MOCK MODE
          </span>
        )}
        {confPct != null && (
          <span className="text-xs text-slate-500 ml-auto">
            Self-reported confidence: <span className="text-slate-300 font-mono">{confPct}%</span>
          </span>
        )}
      </div>

      {/* Confidence bar */}
      {confPct != null && (
        <div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                confPct >= 85 ? 'bg-emerald-500' : confPct >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${confPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Rationale */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rationale</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{data.rationale}</p>
      </div>

      {/* Reasoning trace */}
      {data.reasoningTrace && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reasoning trace</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-mono">{data.reasoningTrace}</p>
        </div>
      )}

      {/* Referenced checks + citations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.referencedCheckIds?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="w-3 h-3 text-slate-500" />
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Referenced checks</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.referencedCheckIds.map(id => (
                <span key={id} className="text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.citations?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="w-3 h-3 text-slate-500" />
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Citations</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.citations.map((c, i) => (
                <span
                  key={i}
                  title={c.description}
                  className="text-[11px] font-mono bg-violet-950/30 text-violet-400 border border-violet-900 px-1.5 py-0.5 rounded cursor-default"
                >
                  {c.statute}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Token usage */}
      {data.tokenUsage > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Cpu className="w-3 h-3" />
          <span>{data.model ?? 'gpt-4o-mini'} · {data.tokenUsage} tokens</span>
        </div>
      )}
      {data.tokenUsage === 0 && data.model === 'mock' && (
        <div className="flex items-center gap-2 text-[11px] text-slate-700">
          <Cpu className="w-3 h-3" />
          <span>mock mode · 0 tokens</span>
        </div>
      )}
    </div>
  )
}
