/**
 * Mock API Response Generator
 *
 * Generates realistic WCP decision responses for testing without an OpenAI API key.
 * Uses deterministic logic based on the extracted WCP data.
 */

// Inline corpus for mock mode — loads from dbwd-corpus.json when available
// In production, this would load from the database via retrieval service
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

interface CorpusEntry {
  jobTitle: string;
  baseRate: number;
  fringeRate: number;
  aliases: string[];
}

function loadMockCorpus(): Record<string, { base: number; fringe: number }> {
  const candidates = [
    resolve(process.cwd(), "data/dbwd-corpus.json"),
    resolve(process.cwd(), "data/dbwd-rates.json"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw) as CorpusEntry[] | { trades?: Array<{ trade: string; baseRate: number; fringeRate: number; aliases?: string[] }> };
        const result: Record<string, { base: number; fringe: number }> = {};

        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            result[entry.jobTitle] = { base: entry.baseRate, fringe: entry.fringeRate };
            for (const alias of entry.aliases) {
              result[alias] = { base: entry.baseRate, fringe: entry.fringeRate };
            }
          }
        } else if (parsed.trades) {
          for (const entry of parsed.trades) {
            result[entry.trade] = { base: entry.baseRate, fringe: entry.fringeRate };
            for (const alias of entry.aliases ?? []) {
              result[alias] = { base: entry.baseRate, fringe: entry.fringeRate };
            }
          }
        }

        return result;
      } catch {
        continue;
      }
    }
  }

  // Fallback to hardcoded 5-trade corpus if no file found
  return {
    Electrician: { base: 51.69, fringe: 34.63 },
    Laborer: { base: 26.45, fringe: 12.5 },
    Plumber: { base: 48.2, fringe: 28.1 },
    Carpenter: { base: 45.0, fringe: 25.0 },
    Mason: { base: 42.5, fringe: 22.5 },
  };
}

const IN_MEMORY_CORPUS = loadMockCorpus();

/**
 * Generate a mock WCP decision based on the extracted data
 */
export function generateMockWcpDecision(input: string) {
  const roleMatch = input.match(/role[:\s]+(\w[\w\s]*)/i);
  const hoursMatch = input.match(/hours[:\s]+(\d+(?:\.\d+)?)/i);
  const wageMatch = input.match(/wage[:\s]+\$?(\d+(?:\.\d+)?)/i);
  const fringeMatch = input.match(/fringe[:\s]+\$?(\d+(?:\.\d+)?)/i);
  const grossPayMatch = input.match(/gross\s*pay[:\s]+\$?(\d+(?:\.\d+)?)/i);

  const role = roleMatch ? roleMatch[1].trim() : 'UNKNOWN';
  const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
  const wage = wageMatch ? parseFloat(wageMatch[1]) : 0;
  const fringe = fringeMatch ? parseFloat(fringeMatch[1]) : null;
  const grossPay = grossPayMatch ? parseFloat(grossPayMatch[1]) : null;

  // Case-insensitive corpus lookup (also check aliases)
  const corpusEntry = Object.entries(IN_MEMORY_CORPUS).find(
    ([key]) => key.toLowerCase() === role.toLowerCase()
  );

  const violations = [];
  let status: 'Approved' | 'Revise' | 'Reject' = 'Approved';

  if (!corpusEntry) {
    status = 'Reject';
    const knownTrades = Object.keys(IN_MEMORY_CORPUS).join(', ');
    violations.push({ type: 'Invalid Role', detail: `Unknown role: ${role}. Known trades: ${knownTrades}.` });
  } else {
    const [tradeName, dbwdRate] = corpusEntry;

    if (wage < dbwdRate.base) {
      status = 'Reject';
      violations.push({ type: 'Underpay', detail: `Wage $${wage}/hr is below DBWD base rate of $${dbwdRate.base}/hr for ${tradeName}.` });
    }

    if (fringe !== null && fringe < dbwdRate.fringe) {
      if (status === 'Approved') status = 'Revise';
      violations.push({ type: 'Fringe Shortfall', detail: `Fringe $${fringe}/hr is below DBWD required fringe $${dbwdRate.fringe}/hr for ${tradeName}.` });
    }

    if (hours > 40) {
      const regularHrs = Math.min(hours, 40);
      const overtimeHrs = hours - 40;
      const correctGross = regularHrs * dbwdRate.base + overtimeHrs * dbwdRate.base * 1.5;
      const reportedGross = grossPay ?? (wage * hours);
      const otCorrect = reportedGross >= correctGross - 0.01;
      if (!otCorrect) {
        if (status !== 'Reject') status = 'Revise';
        violations.push({ type: 'Overtime', detail: `OT underpaid: reported gross $${reportedGross.toFixed(2)} vs required $${correctGross.toFixed(2)}.` });
      }
    }
  }

  let explanation = '';
  switch (status) {
    case 'Approved':
      explanation = `This WCP is approved. The ${role} role is valid, hours (${hours}) are within limits, and wage ($${wage}/hr) meets or exceeds the DBWD base rate.`;
      break;
    case 'Revise':
      explanation = `This WCP requires revision. The ${role} role and wage are valid, but there are overtime violations that need to be addressed.`;
      break;
    case 'Reject':
      explanation = `This WCP is rejected due to compliance violations that must be corrected.`;
      break;
  }

  const trace = [
    'Step 1: Extracted WCP data from input',
    'Step 2: Validated role against DBWD rates',
    'Step 3: Checked wage compliance',
    'Step 4: Checked overtime requirements',
    'Step 5: Generated compliance decision'
  ];

  return {
    status,
    explanation,
    findings: violations,
    trace,
    requestId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return key === 'mock' || key === 'mock-key' || key === 'test-api-key' || !key || key === '';
}
