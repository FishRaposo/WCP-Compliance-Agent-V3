import { useState, useRef } from 'react'
import { GitBranch, ExternalLink, Loader2, Shield } from 'lucide-react'
import { ScenarioSelector } from './components/ScenarioSelector'
import { PipelineVisualizer } from './components/PipelineVisualizer'
import { KeyInput } from './components/KeyInput'
import type { AnalysisResult } from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [content, setContent] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  const isMockMode = !apiKey || apiKey.trim() === ''

  async function analyze() {
    if (!content.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setLoadingStep(1)

    const stepTimer1 = setTimeout(() => setLoadingStep(2), 600)
    const stepTimer2 = setTimeout(() => setLoadingStep(3), 1400)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey.trim()) headers['X-OpenAI-Key'] = apiKey.trim()

      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: content.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Request failed')
      setResult(data)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      setLoading(false)
      setLoadingStep(0)
    }
  }

  function handleScenario(input: string) {
    setContent(input)
    setResult(null)
    setError(null)
  }

  const STEP_LABELS = ['', 'Layer 1: Extracting...', 'Layer 2: Reasoning...', 'Layer 3: Scoring...']

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-slate-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-violet-400" />
            <span className="font-semibold text-lg text-white">WCP Compliance Agent</span>
            <span className="text-xs bg-violet-900/50 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full">
              v0.6.0
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden sm:block">Three-layer AI decision pipeline</span>
            <a
              href="https://github.com/FishRaposo/WCP-Compliance-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              <span className="hidden sm:inline">Source</span>
            </a>
            <a
              href="https://github.com/FishRaposo/WCP-Compliance-Agent/blob/main/docs/quick-start.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Docs</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-slate-800 px-6 py-10 bg-gradient-to-b from-violet-950/20 to-transparent">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Every compliance decision, fully explained
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg">
            Three layers of evidence. Every finding cites a specific regulation.
            Every decision has a replayable audit trail. This is how you build AI you can defend in court.
          </p>

          {/* Pipeline steps */}
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            {['Layer 1 · Deterministic', '→', 'Layer 2 · LLM Verdict', '→', 'Layer 3 · Trust Score'].map((s, i) => (
              <span key={i} className={s === '→'
                ? 'text-slate-600 text-lg'
                : 'text-xs font-mono bg-slate-800/80 border border-slate-700 text-slate-300 px-3 py-1 rounded-full'
              }>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* API Key input */}
          <KeyInput apiKey={apiKey} onChange={setApiKey} isMockMode={isMockMode} />

          {/* Scenario selector */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Pre-loaded scenarios</p>
            <ScenarioSelector onSelect={handleScenario} activeContent={content} />
          </div>

          {/* Input */}
          <div className="space-y-3">
            <label htmlFor="payroll-input" className="block text-xs text-slate-500 uppercase tracking-wider font-medium">Or enter custom payroll text</label>
            <textarea
              id="payroll-input"
              className="w-full h-28 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              placeholder="e.g. Role: Electrician, Hours: 45, Wage: 35.00, Fringe: 20.00"
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze() }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Ctrl/Cmd + Enter to analyze</span>
              <button
                onClick={analyze}
                disabled={loading || !content.trim()}
                aria-busy={loading}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {loading ? STEP_LABELS[loadingStep] || 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div ref={resultRef}>
              <PipelineVisualizer result={result} isMockMode={result.mockMode ?? isMockMode} />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-5 text-center">
        <p className="text-xs text-slate-600">
          MIT License · Built by{' '}
          <a href="https://github.com/FishRaposo" className="text-slate-500 hover:text-slate-300 transition-colors">
            Vinícius Raposo
          </a>
          {' · '}
          <a
            href="https://github.com/FishRaposo/WCP-Compliance-Agent"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            FishRaposo/WCP-Compliance-Agent
          </a>
        </p>
      </footer>
    </div>
  )
}

