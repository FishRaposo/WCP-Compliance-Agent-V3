import { CheckCircle, XCircle, Database, Tag } from 'lucide-react'
import type { DeterministicReport, CheckResult } from '../types'

interface Props {
  data: DeterministicReport
}

function SeverityBadge({ severity }: { severity?: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-950/60 text-red-300 border-red-800',
    high:     'bg-orange-950/60 text-orange-300 border-orange-800',
    error:    'bg-orange-950/60 text-orange-300 border-orange-800',
    warning:  'bg-amber-950/60 text-amber-300 border-amber-800',
    info:     'bg-slate-800 text-slate-400 border-slate-700',
  }
  if (!severity) return null
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${map[severity] ?? map.info}`}>
      {severity}
    </span>
  )
}

function StatusIcon({ passed }: { passed: boolean }) {
  if (passed) return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
  return <XCircle className="w-4 h-4 text-red-400 shrink-0" />
}

function ClassificationBadge({ method, confidence }: { method: string; confidence: number }) {
  const colors: Record<string, string> = {
    exact:    'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    alias:    'bg-teal-900/40 text-teal-300 border-teal-800',
    semantic: 'bg-blue-900/40 text-blue-300 border-blue-800',
    manual:   'bg-violet-900/40 text-violet-300 border-violet-800',
    unknown:  'bg-red-900/40 text-red-300 border-red-800',
  }
  const pct = Math.round(confidence * 100)
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${colors[method] ?? colors.unknown}`}>
      <Tag className="w-2.5 h-2.5" />
      {method} · {pct}%
    </span>
  )
}

export function Layer1Panel({ data }: Props) {
  const ext = data.extracted
  const passCount = data.checks.filter((c: CheckResult) => c.passed).length
  const failCount = data.checks.filter((c: CheckResult) => !c.passed).length

  return (
    <div className="space-y-4">
      {/* Extracted fields */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Extracted Fields</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Role',      value: ext.role ?? '—' },
            { label: 'Hours',     value: ext.hours != null ? `${ext.hours}h` : '—' },
            { label: 'Wage',      value: ext.wage != null ? `$${ext.wage}/hr` : '—' },
            { label: 'Fringe',    value: ext.fringe != null ? `$${ext.fringe}/hr` : '—' },
            { label: 'Gross Pay', value: ext.grossPay != null ? `$${ext.grossPay}` : '—' },
            {
              label: 'DBWD Rate',
              value: data.dbwdRate
                ? `$${data.dbwdRate.baseRate} + $${data.dbwdRate.fringeRate}`
                : '—',
            },
          ].map(({ label, value }) => (
            <div key={label} className="text-xs">
              <div className="text-slate-500 mb-0.5">{label}</div>
              <div className="font-mono text-slate-200">{String(value)}</div>
            </div>
          ))}
        </div>

        {/* Classification method */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-500">Classification:</span>
          <ClassificationBadge
            method={data.classificationMethod}
            confidence={data.classificationConfidence}
          />
          {data.dbwdRate?.trade && (
            <span className="text-[11px] font-mono text-slate-500">
              {data.dbwdRate.trade}
              {data.dbwdRate.dbwdId ? ` · ${data.dbwdRate.dbwdId}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Checks summary */}
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" /> {passCount} passed
        </span>
        <span className="flex items-center gap-1 text-red-400">
          <XCircle className="w-3.5 h-3.5" /> {failCount} failed
        </span>
        <span className="ml-auto text-slate-500">
          Score: {(data.deterministicScore * 100).toFixed(0)}%
        </span>
      </div>

      {/* Check rows */}
      <div className="space-y-2">
        {data.checks.map((check: CheckResult) => (
          <div
            key={check.id}
            className={`rounded-lg border p-3 text-xs ${
              !check.passed
                ? 'bg-red-950/20 border-red-900'
                : 'bg-emerald-950/10 border-emerald-900/40'
            }`}
          >
            <div className="flex items-start gap-2">
              <StatusIcon passed={check.passed} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-slate-400 text-[11px]">{check.id}</span>
                  <span className="text-slate-500 capitalize">{check.type.replace(/_/g, ' ')}</span>
                  <SeverityBadge severity={check.severity} />
                  {check.expected != null && check.actual != null && (
                    <span className="text-[10px] font-mono text-slate-600">
                      expected ${check.expected} · got ${check.actual}
                    </span>
                  )}
                </div>
                <p className="text-slate-300 leading-relaxed">{check.message}</p>
                {check.regulation && (
                  <span className="inline-block mt-1 text-[10px] font-mono text-violet-400 bg-violet-950/30 px-1.5 py-0.5 rounded">
                    {check.regulation}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
