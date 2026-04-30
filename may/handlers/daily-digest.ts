#!/usr/bin/env bun
/**
 * Daily digest generator — runs once per day, writes to agents/shared/daily-digests/
 * Includes top5-metrics section for at-a-glance health.
 */
import { Database } from "bun:sqlite";
import { execSync } from "child_process";
import { writeFileSync, existsSync, mkdirSync } from "fs";

const db = new Database(".state/may.db", { readonly: true });

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function getTop5Metrics(): string {
  try {
    const output = execSync("bun agents/may/workspace/tools/top5-metrics.ts --digest", {
      encoding: "utf-8",
      timeout: 30000,
      cwd: process.cwd(),
    });
    return output.trim();
  } catch (e) {
    return "⚠️ Top-5 metrics unavailable";
  }
}

function getAgentActivity(): string {
  const rows = db.query(`
    SELECT agent, COUNT(*) as n, 
      SUM(CASE WHEN status IN ('done','success') THEN 1 ELSE 0 END) as done
    FROM sessions 
    WHERE startedAt > ? 
    GROUP BY agent 
    ORDER BY n DESC
  `).all(Date.now() - 24 * 3600_000) as { agent: string; n: number; done: number }[];
  
  if (rows.length === 0) return "No sessions in last 24h.";
  
  const total = rows.reduce((s, r) => s + r.n, 0);
  const lines = rows.map(r => `- **${r.agent}**: ${r.n} sessions (${r.done} done)`);
  return `## Agent Activity (${total} sessions)\n\n${lines.join("\n")}`;
}

function getQuality(): string {
  const row = db.query(`
    SELECT COUNT(*) as n, ROUND(AVG(quality), 2) as avgQ, ROUND(AVG(efficiency), 2) as avgE,
      SUM(CASE WHEN quality >= 0.7 THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN quality < 0.5 THEN 1 ELSE 0 END) as bad
    FROM evaluations WHERE createdAt > ?
  `).get(Date.now() - 24 * 3600_000) as any;
  
  if (!row || row.n === 0) return "## Quality\n\nNo evaluations in last 24h.";
  return `## Quality\n\n- **${row.n}** sessions evaluated — quality **${row.avgQ}**/1.0, efficiency **${row.avgE}**/1.0\n- ${row.good} good, ${row.bad} needs improvement`;
}

export default async function handler() {
  const date = getDateStr();
  const dir = "agents/shared/daily-digests";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const outPath = `${dir}/${date}.md`;
  
  const metrics = getTop5Metrics();
  const activity = getAgentActivity();
  const quality = getQuality();
  
  const content = `# Daily Digest — ${date}

## Top 5 Metrics

${metrics}

${quality}

${activity}
`;

  writeFileSync(outPath, content);
  console.log(`✅ Daily digest written: ${outPath}`);
  return { written: outPath };
}

// Allow direct execution
if (import.meta.main) {
  handler().then(r => console.log("Done:", r.written));
}
