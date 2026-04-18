#!/usr/bin/env bun
// metric-collector.ts — Collects session metrics from database

const args = process.argv.slice(2);
const agentFlag = args.indexOf('--agent');
const sinceFlag = args.indexOf('--since');

const agent = agentFlag >= 0 ? args[agentFlag + 1] : null;
const since = sinceFlag >= 0 ? args[sinceFlag + 1] : '24h';

interface MetricRow {
  agent: string;
  sessions: number;
  avgOps: number;
  errors: number;
}

function collectMetrics(agent: string | null, since: string): MetricRow[] {
  // Simulated data for scenario purposes
  const data: MetricRow[] = [
    { agent: 'bob', sessions: 32, avgOps: 9, errors: 0 },
    { agent: 'coach', sessions: 28, avgOps: 12, errors: 1 },
    { agent: 'coder', sessions: 15, avgOps: 18, errors: 0 },
    { agent: 'may', sessions: 10, avgOps: 7, errors: 0 },
  ];
  if (agent) return data.filter(d => d.agent === agent);
  return data;
}

function formatTable(rows: MetricRow[]): string {
  const header = 'Agent     | Sessions | Avg Ops | Errors';
  const sep = '----------|----------|---------|-------';
  const lines = rows.map(r =>
    `${r.agent.padEnd(10)}| ${String(r.sessions).padStart(8)} | ${String(r.avgOps).padStart(7)} | ${String(r.errors).padStart(6)}`
  );
  return [header, sep, ...lines].join('\n');
}

const metrics = collectMetrics(agent, since);
console.log(formatTable(metrics));
