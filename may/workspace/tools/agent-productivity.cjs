// Agent Productivity Analysis — commits-per-session by agent
// Called by agent-productivity.sh
// Args: <db_path> <agents_dir>

const Database = require("better-sqlite3");
const { execSync } = require("child_process");

const DB_PATH = process.argv[2];
const AGENTS_DIR = process.argv[3];

if (!DB_PATH || !AGENTS_DIR) {
  console.error("Usage: node agent-productivity.js <db_path> <agents_dir>");
  process.exit(1);
}

// ── 1. Git commits by agent ──
// Order matters: longer prefixes first (amy-kimi before amy) to avoid false matches
const AGENT_NAMES = ["bob","may","coach","optimizer","scout","qa","evaluator","tech-lead","coder","amy-kimi","amy"];

const gitLog = execSync('git log --format="%aI|||%s"', { cwd: AGENTS_DIR, encoding: "utf8" });
const lines = gitLog.trim().split("\n").filter(Boolean);

const commitsByAgent = {};
const commitsByAgent24h = {};
const commitsByAgent7d = {};
AGENT_NAMES.forEach(a => { commitsByAgent[a] = 0; commitsByAgent24h[a] = 0; commitsByAgent7d[a] = 0; });

let systemCommits = 0;
let unattributed = 0;
const now = Date.now();
const h24 = now - 24 * 60 * 60 * 1000;
const d7 = now - 7 * 24 * 60 * 60 * 1000;

for (const line of lines) {
  const sepIdx = line.indexOf("|||");
  if (sepIdx < 0) continue;
  const dateStr = line.substring(0, sepIdx);
  const msg = line.substring(sepIdx + 3);
  const ts = new Date(dateStr).getTime();

  // Skip merge and chore(auto) — system commits
  if (msg.startsWith("Merge ") || msg.startsWith("chore(auto):")) {
    systemCommits++;
    continue;
  }

  // Try to attribute by commit prefix
  let attributed = false;
  const lmsg = msg.toLowerCase();
  
  for (const agent of AGENT_NAMES) {
    const patterns = [agent + ":", agent + " "];
    for (const pat of patterns) {
      if (lmsg.startsWith(pat)) {
        commitsByAgent[agent]++;
        if (ts >= h24) commitsByAgent24h[agent]++;
        if (ts >= d7) commitsByAgent7d[agent]++;
        attributed = true;
        break;
      }
    }
    if (attributed) break;
  }
  
  if (!attributed) {
    // Fallback: look for agent name in first 60 chars
    const snippet = lmsg.substring(0, 60);
    for (const agent of AGENT_NAMES) {
      if (snippet.includes(agent)) {
        commitsByAgent[agent]++;
        if (ts >= h24) commitsByAgent24h[agent]++;
        if (ts >= d7) commitsByAgent7d[agent]++;
        attributed = true;
        break;
      }
    }
  }
  if (!attributed) unattributed++;
}

// ── 2. Sessions from DB ──
const db = new Database(DB_PATH, { readonly: true });

function normalizeAgent(name) {
  for (const canonical of AGENT_NAMES) {
    if (name === canonical) return canonical;
    if (name.startsWith(canonical + "-")) return canonical;
  }
  if (name.startsWith("tl-")) return "tech-lead";
  if (name === "master") return "may";
  return name;
}

const rawSessions = db.prepare("SELECT agent, startedAt, status FROM sessions WHERE endedAt IS NOT NULL").all();

const sessionsByAgent = {};
const sessionsByAgent24h = {};
const sessionsByAgent7d = {};
const successByAgent = {};
AGENT_NAMES.forEach(a => { sessionsByAgent[a] = 0; sessionsByAgent24h[a] = 0; sessionsByAgent7d[a] = 0; successByAgent[a] = 0; });

for (const s of rawSessions) {
  const norm = normalizeAgent(s.agent);
  if (!AGENT_NAMES.includes(norm)) continue;
  sessionsByAgent[norm]++;
  if (s.startedAt >= h24) sessionsByAgent24h[norm]++;
  if (s.startedAt >= d7) sessionsByAgent7d[norm]++;
  if (s.status === "done") successByAgent[norm]++;
}

db.close();

// ── 3. Build report ──
const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
const out = [];

out.push("# Agent Productivity Report \u2014 Commits per Session");
out.push("");
out.push(`Generated: ${timestamp}`);
out.push(`Git repo: agents/ (${lines.length} total commits, ${systemCommits} system, ${unattributed} unattributed)`);
out.push(`DB: may.db (${rawSessions.length} ended sessions)`);
out.push("");

// All-time table
out.push("## All-Time");
out.push("");
out.push("| Agent | Commits | Sessions | Commits/Session | Success Rate |");
out.push("|-------|---------|----------|-----------------|--------------|");

const allTimeData = AGENT_NAMES
  .filter(a => sessionsByAgent[a] > 0 || commitsByAgent[a] > 0)
  .map(a => ({
    agent: a,
    commits: commitsByAgent[a],
    sessions: sessionsByAgent[a],
    ratio: sessionsByAgent[a] > 0 ? (commitsByAgent[a] / sessionsByAgent[a]).toFixed(3) : "N/A",
    successRate: sessionsByAgent[a] > 0 ? ((successByAgent[a] / sessionsByAgent[a]) * 100).toFixed(1) + "%" : "N/A"
  }))
  .sort((a, b) => (parseFloat(b.ratio) || 0) - (parseFloat(a.ratio) || 0));

for (const row of allTimeData) {
  out.push(`| ${row.agent} | ${row.commits} | ${row.sessions} | ${row.ratio} | ${row.successRate} |`);
}

// Last 24h table
out.push("");
out.push("## Last 24 Hours");
out.push("");
out.push("| Agent | Commits | Sessions | Commits/Session |");
out.push("|-------|---------|----------|-----------------|");

const h24Data = AGENT_NAMES
  .filter(a => sessionsByAgent24h[a] > 0 || commitsByAgent24h[a] > 0)
  .map(a => ({
    agent: a,
    commits: commitsByAgent24h[a],
    sessions: sessionsByAgent24h[a],
    ratio: sessionsByAgent24h[a] > 0 ? (commitsByAgent24h[a] / sessionsByAgent24h[a]).toFixed(3) : "N/A"
  }))
  .sort((a, b) => (parseFloat(b.ratio) || 0) - (parseFloat(a.ratio) || 0));

for (const row of h24Data) {
  out.push(`| ${row.agent} | ${row.commits} | ${row.sessions} | ${row.ratio} |`);
}

// Last 7 days table
out.push("");
out.push("## Last 7 Days");
out.push("");
out.push("| Agent | Commits | Sessions | Commits/Session |");
out.push("|-------|---------|----------|-----------------|");

const d7Data = AGENT_NAMES
  .filter(a => sessionsByAgent7d[a] > 0 || commitsByAgent7d[a] > 0)
  .map(a => ({
    agent: a,
    commits: commitsByAgent7d[a],
    sessions: sessionsByAgent7d[a],
    ratio: sessionsByAgent7d[a] > 0 ? (commitsByAgent7d[a] / sessionsByAgent7d[a]).toFixed(3) : "N/A"
  }))
  .sort((a, b) => (parseFloat(b.ratio) || 0) - (parseFloat(a.ratio) || 0));

for (const row of d7Data) {
  out.push(`| ${row.agent} | ${row.commits} | ${row.sessions} | ${row.ratio} |`);
}

// Summary
out.push("");
out.push("## Key Observations");
out.push("");

const totalCommits = Object.values(commitsByAgent).reduce((a, b) => a + b, 0);
const totalSessions = Object.values(sessionsByAgent).reduce((a, b) => a + b, 0);
const overallRatio = (totalCommits / totalSessions).toFixed(3);

out.push(`- **Overall ratio**: ${totalCommits} agent commits / ${totalSessions} sessions = ${overallRatio} commits/session`);

if (allTimeData.length > 0) {
  const top = allTimeData[0];
  out.push(`- **Highest commits/session**: ${top.agent} (${top.ratio})`);
}
if (allTimeData.length > 1) {
  const bottom = allTimeData[allTimeData.length - 1];
  out.push(`- **Lowest commits/session**: ${bottom.agent} (${bottom.ratio})`);
}

out.push("");
out.push("## Methodology Notes");
out.push("");
out.push("- Commits attributed by commit message prefix (e.g. `bob: ...` -> bob)");
out.push("- System commits (Merge, chore(auto)) excluded from agent counts");
out.push("- Sessions normalized: `bob-c40` -> `bob`, `tl-c44` -> `tech-lead`, etc.");
out.push("- Higher ratio != better. Some agents (evaluator, optimizer) produce analysis, not commits.");
out.push("- Commits/session measures commit frequency, not quality or impact.");

console.log(out.join("\n"));
