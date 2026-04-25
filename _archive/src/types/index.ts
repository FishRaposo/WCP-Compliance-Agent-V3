/**
 * Shared types and interfaces used across the WCP AI Agent project
 */

// WCP Decision Types
export interface WCPDecision {
  status: 'Approved' | 'Revise' | 'Reject';
  explanation: string;
  findings: Finding[];
  trace: string[];
  health?: {
    cycleTime: number;
    tokenUsage: number;
    validationScore: number;
    confidence: number;
  };
}

export interface Finding {
  type: string;
  detail: string;
}

// WCP Data Types
export interface WCPData {
  role: string;
  hours: number;
  wage: number;
}

export interface DBWDRates {
  base: number;
  fringe: number;
}

// Showcase Scenario Types
export interface ShowcaseScenario {
  name: string;
  description: string;
  input: string;
  expectedStatus: 'Approved' | 'Revise' | 'Reject';
  expectedFindings?: Finding[];
}

// API Types
export interface AnalyzeRequest {
  content: string;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: WCPDecision;
  error?: string;
}

// Health Metrics Types
export interface HealthMetrics {
  confidence: number;
  latency: number;
  tokens: number;
}

// Error Types
export interface ErrorInfo {
  code: string;
  message: string;
  details?: unknown;
}
