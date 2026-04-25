export interface ExtractedWCP {
  rawInput: string
  workerName?: string
  socialSecurityLast4?: string
  role: string
  tradeCode?: string
  localityCode?: string
  hours: number
  regularHours?: number
  overtimeHours?: number
  hoursByDay?: {
    mon?: number; tue?: number; wed?: number
    thu?: number; fri?: number; sat?: number; sun?: number
  }
  wage: number
  fringe?: number
  grossPay?: number
  weekEnding?: string
  projectId?: string
}

export interface DBWDRateInfo {
  dbwdId: string
  baseRate: number
  fringeRate: number
  totalRate: number
  version: string
  effectiveDate: string
  locality?: string
  trade: string
  tradeCode?: string
}

export interface CheckResult {
  id: string
  type: string
  passed: boolean
  regulation: string
  expected?: number
  actual?: number
  difference?: number
  severity: 'info' | 'warning' | 'error' | 'critical' | 'high'
  message: string
}

export interface DeterministicReport {
  traceId: string
  dbwdVersion: string
  timestamp: string
  extracted: ExtractedWCP
  dbwdRate: DBWDRateInfo
  checks: CheckResult[]
  classificationMethod: 'exact' | 'alias' | 'semantic' | 'manual' | 'unknown'
  classificationConfidence: number
  deterministicScore: number
  timings?: { stage: string; ms: number }[]
}

export interface RegulatoryCitation {
  statute: string
  description: string
  dbwdId?: string
}

export interface LLMVerdict {
  traceId: string
  status: 'Approved' | 'Revise' | 'Reject'
  rationale: string
  referencedCheckIds: string[]
  citations: RegulatoryCitation[]
  selfConfidence: number
  reasoningTrace: string
  tokenUsage: number
  model: string
  timestamp: string
}

export interface TrustScore {
  score: number
  components: {
    deterministic: number
    classification: number
    llmSelf: number
    agreement: number
  }
  band: 'auto' | 'flag_for_review' | 'require_human'
  reasons: string[]
}

export interface HumanReview {
  required: boolean
  status: 'not_required' | 'pending' | 'approved' | 'rejected'
  queuedAt?: string
  reviewedAt?: string
  reviewer?: string
  notes?: string
}

export interface AuditEvent {
  timestamp: string
  stage: string
  event: string
  details?: Record<string, unknown>
  hash?: string
}

export interface AnalysisResult {
  traceId: string
  finalStatus: 'Approved' | 'Revise' | 'Reject' | 'Pending Human Review'
  deterministic: DeterministicReport
  verdict: LLMVerdict
  trust: TrustScore
  humanReview: HumanReview
  auditTrail: AuditEvent[]
  finalizedAt: string
  health?: {
    cycleTime: number
    tokenUsage: number
    validationScore: number
    confidence: number
  }
  // API-added metadata
  requestId?: string
  timestamp?: string
  mockMode?: boolean
}
