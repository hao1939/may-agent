/**
 * Hao Alignment: Correction Rate Measurement
 * 
 * Measures how often Hao corrects agent actions — a key alignment metric.
 * Lower correction rate = agents are better aligned with Hao's preferences.
 */

export interface Session {
  id: string;
  agent: string;
  timestamp: number;
  corrected: boolean;       // Did Hao intervene/correct?
  correctionType?: 'redirect' | 'reject' | 'modify' | 'escalate';
  context?: string;
}

export interface CorrectionMetrics {
  totalSessions: number;
  correctedSessions: number;
  correctionRate: number;       // 0.0 to 1.0
  byAgent: Record<string, { total: number; corrected: number; rate: number }>;
  byType: Record<string, number>;
  trend: 'improving' | 'stable' | 'degrading' | 'insufficient-data';
}

export function calculateCorrectionRate(sessions: Session[]): CorrectionMetrics {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      correctedSessions: 0,
      correctionRate: 0,
      byAgent: {},
      byType: {},
      trend: 'insufficient-data',
    };
  }

  const corrected = sessions.filter(s => s.corrected);
  const rate = corrected.length / sessions.length;

  // By agent
  const byAgent: Record<string, { total: number; corrected: number; rate: number }> = {};
  for (const s of sessions) {
    if (!byAgent[s.agent]) byAgent[s.agent] = { total: 0, corrected: 0, rate: 0 };
    byAgent[s.agent].total++;
    if (s.corrected) byAgent[s.agent].corrected++;
  }
  for (const agent of Object.keys(byAgent)) {
    byAgent[agent].rate = byAgent[agent].corrected / byAgent[agent].total;
  }

  // By type
  const byType: Record<string, number> = {};
  for (const s of corrected) {
    const type = s.correctionType || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  }

  // Trend: compare first half vs second half
  const trend = calculateTrend(sessions);

  return {
    totalSessions: sessions.length,
    correctedSessions: corrected.length,
    correctionRate: rate,
    byAgent,
    byType,
    trend,
  };
}

function calculateTrend(sessions: Session[]): CorrectionMetrics['trend'] {
  if (sessions.length < 10) return 'insufficient-data';

  const sorted = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const firstRate = firstHalf.filter(s => s.corrected).length / firstHalf.length;
  const secondRate = secondHalf.filter(s => s.corrected).length / secondHalf.length;

  const diff = secondRate - firstRate;
  if (diff < -0.05) return 'improving';
  if (diff > 0.05) return 'degrading';
  return 'stable';
}

export function formatReport(metrics: CorrectionMetrics): string {
  const lines: string[] = [
    '📊 Hao Alignment — Correction Rate Report',
    '═'.repeat(45),
    `Total sessions: ${metrics.totalSessions}`,
    `Corrected: ${metrics.correctedSessions} (${(metrics.correctionRate * 100).toFixed(1)}%)`,
    `Trend: ${metrics.trend}`,
    '',
  ];

  if (Object.keys(metrics.byAgent).length > 0) {
    lines.push('By Agent:');
    for (const [agent, data] of Object.entries(metrics.byAgent)) {
      lines.push(`  ${agent}: ${data.corrected}/${data.total} (${(data.rate * 100).toFixed(1)}%)`);
    }
    lines.push('');
  }

  if (Object.keys(metrics.byType).length > 0) {
    lines.push('By Correction Type:');
    for (const [type, count] of Object.entries(metrics.byType)) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  return lines.join('\n');
}
