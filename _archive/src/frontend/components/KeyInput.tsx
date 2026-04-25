import { useState } from 'react'
import { Key, Eye, EyeOff, AlertTriangle } from 'lucide-react'

interface KeyInputProps {
  apiKey: string
  onChange: (key: string) => void
  isMockMode: boolean
}

export function KeyInput({ apiKey, onChange, isMockMode }: KeyInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 relative">
        <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type={visible ? 'text' : 'password'}
          aria-label="OpenAI API key"
          placeholder="OpenAI API key (optional — never stored, used only for this request)"
          value={apiKey}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition font-mono"
          autoComplete="off"
          spellCheck={false}
          aria-label="OpenAI API key"
        />
        <button
          type="button"
          aria-label={visible ? 'Hide API key' : 'Show API key'}
          onClick={() => setVisible(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded p-0.5"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {isMockMode && (
        <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/50 text-amber-300 rounded-lg px-3 py-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            No API key — showing <strong>mock responses</strong>. The decision structure is real;
            the LLM rationale is deterministic placeholder text. Add your key above for live OpenAI reasoning.
          </span>
        </div>
      )}
    </div>
  )
}
