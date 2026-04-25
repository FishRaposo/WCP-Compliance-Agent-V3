interface Scenario {
  label: string
  emoji: string
  input: string
  description: string
}

const SCENARIOS: Scenario[] = [
  {
    label: 'Clean — Approved',
    emoji: '✅',
    input: 'Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63',
    description: 'Electrician at prevailing wage, no overtime',
  },
  {
    label: 'Underpayment',
    emoji: '❌',
    input: 'Role: Electrician, Hours: 40, Wage: 45.00, Fringe: 34.63',
    description: 'Base wage $6.69/hr below DBWD rate',
  },
  {
    label: 'OT Violation',
    emoji: '⚠️',
    input: 'Role: Laborer, Hours: 45, Wage: 26.45, Gross Pay: 1190.25',
    description: 'OT hours paid at straight time instead of 1.5×',
  },
  {
    label: 'Fringe Shortfall',
    emoji: '⚠️',
    input: 'Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 20.00',
    description: 'Fringe benefits $14.63/hr below prevailing rate',
  },
  {
    label: 'Unknown Role',
    emoji: '🔍',
    input: 'Role: Wire Technician, Hours: 40, Wage: 40.00',
    description: 'Trade classification not found in DBWD corpus',
  },
  {
    label: 'Extreme OT',
    emoji: '🔴',
    input: 'Role: Laborer, Hours: 80, Wage: 26.45',
    description: '40 hours OT — triggers human review',
  },
]

interface ScenarioSelectorProps {
  onSelect: (input: string) => void
  activeContent: string
}

export function ScenarioSelector({ onSelect, activeContent }: ScenarioSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {SCENARIOS.map((s) => {
        const isActive = activeContent === s.input
        return (
          <button
            key={s.label}
            onClick={() => onSelect(s.input)}
            className={`text-left p-3 rounded-xl border text-xs transition-all ${
              isActive
                ? 'bg-violet-900/40 border-violet-600 text-white'
                : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            <div className="text-base mb-1">{s.emoji}</div>
            <div className="font-medium text-slate-200 text-xs mb-0.5">{s.label}</div>
            <div className="text-slate-500 text-[11px] leading-snug">{s.description}</div>
          </button>
        )
      })}
    </div>
  )
}
