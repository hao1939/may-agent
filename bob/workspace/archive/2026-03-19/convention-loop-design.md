# Convention Loop — Design Document

## Problem

Conventions exist across 4 documents with different loading behavior:

| Document | Auto-injected | Size | Role |
|----------|--------------|------|------|
| `common-sense.md` | Yes (system prompt) | 12.5KB | Behavioral + infra fundamentals |
| `shared/LESSONS.md` | Yes (system prompt) | 4KB | Cross-agent lessons |
| `CONVENTIONS.md` | No (read-on-demand) | 2.5KB | Mandatory protocols |
| `best-practices.md` | No (read-on-demand) | 3KB | Operational guidelines |

Agents follow what's in their system prompt. CONVENTIONS.md and best-practices.md
are reference docs that agents rarely read — they're listed in INDEX.md but
not auto-loaded. The conventions that actually get followed are deployed as
per-agent LESSONS.md entries or heartbeat.md steps.

Meanwhile common-sense.md is bloated with deployment history, ownership
annotations, and status tracking that belongs in the coach's workspace,
not in every agent's context window.

There is no closed loop: no automated measurement, no regression detection,
no graduation. The coach manually greps sessions every 4 hours.

## Design

### 1. Merge docs → one canonical registry + one lean injection

**CONVENTIONS.md** becomes the canonical registry. Merge in:
- best-practices.md safety levels (S0-S3), evidence-first, session hygiene
- common-sense.md rules (deduplicated against existing C1-C7)

**common-sense.md** becomes lean. Strip out:
- Deployment status (`[DEPLOYED]`, `[NATIVE]`) → coach's tracker
- Ownership annotations → coach's tracker  
- Infra implementation notes → Bob's workspace
- History and verification evidence → coach's workspace

What remains in common-sense.md (~3-4KB, down from 12.5KB):
- The behavioral rules themselves, stated once, concisely
- No metadata, no tracking, no ownership — just the rules

Why keep two files instead of fully merging:
- CONVENTIONS.md = reference registry (complete, machine-readable, includes
  things like "check type: mechanical" that agents don't need)
- common-sense.md = agent-facing injection (lean, only behavioral rules
  agents need to internalize, auto-loaded every session)

The relationship: common-sense.md is the **agent-readable subset** of
CONVENTIONS.md. Every rule in common-sense.md has a C-code in CONVENTIONS.md.
CONVENTIONS.md has additional rules that are infra-enforced (agents don't
need to know about them) or reference-only (agents read on demand).

### 2. Convention registry format

CONVENTIONS.md gets a machine-readable section that the handler parses:

```markdown
# Conventions

## Registry

<!-- CONVENTION_REGISTRY_START -->
| Code | Name | Rule | Check | Enforcement |
|------|------|------|-------|-------------|
| C1.1 | read-before-edit | read() before edit() | mechanical | injection + handler |
| C1.2 | complete-reads | Use offset for truncated reads | manual | injection |
| C1.3 | verify-writes | read() after edit()/write() | mechanical | injection + handler |
| C1.4 | finish-clearly | Last action must be finish() | mechanical | injection + handler |
| C2.1 | precise-args | Don't hallucinate tool arguments | mechanical | handler |
| C2.2 | check-exit-codes | Verify bash exit codes | llm-judge | gym |
| C2.3 | no-interactive | No nano/vim/less | mechanical | handler |
| C3.1 | filesystem-truth | Persist important data to files | llm-judge | gym |
| C3.2 | workspace-isolation | Work in agents/[name]/workspace/ | mechanical | handler |
| C3.3 | safe-append | No write() on append-only files | mechanical | handler |
| C4.1 | sync-async | Use call() vs send() correctly | llm-judge | gym |
| C4.2 | handoff-protocol | Write artifact, then send() with path | llm-judge | gym |
| C4.3 | escalation-ladder | Self-fix → peer → supervisor → human | llm-judge | gym |
| C5.1 | claim-equals-proof | Claims backed by tool output | llm-judge | gym + handler |
| C5.2 | quote-sources | Cite line numbers and file paths | llm-judge | gym |
| C5.3 | no-guessing | Say "I can't see it" instead of guessing | llm-judge | gym |
| C6.1 | budget-awareness | Use grep, not 100 reads | mechanical | handler |
| C6.2 | clean-up | Delete temp files | mechanical | handler |
| C6.3 | scope-control | Don't over-refactor | llm-judge | gym |
| C6.4 | no-noise | Every output needs a consumer | llm-judge | gym |
| C6.5 | kv-cache | No volatile data in prompt prefix | infra | code |
| C7.1 | root-is-app | /app is root, no /home or ~ | mechanical | handler |
| C7.2 | no-cd-home | No cd /home or cd ~/ | mechanical | handler |
| C7.3 | relative-paths | Use relative or /app/ paths | mechanical | handler |
| C8.1 | plan-before-acting | State approach before tool calls | llm-judge | gym |
| C8.2 | promise-deliver-report | Promise → Deliver → Report pattern | mechanical | handler |
| C8.3 | one-thing-at-a-time | Small scope, verify between steps | llm-judge | gym |
| C9.1 | fail-gracefully | Handle errors, try alternatives | llm-judge | gym |
| C9.2 | dont-repeat | Different approach after failure | mechanical | handler |
| C9.3 | know-when-to-stop | Escalate after 5+ stuck turns | mechanical | handler |
| C9.4 | escalation-has-content | What/why/tried/need in escalation | llm-judge | gym |
| C10.1 | read-before-asking | Check docs before asking | llm-judge | gym |
| C10.2 | ask-with-context | Include what/tried/stuck/need | llm-judge | gym |
| C10.3 | share-learnings | Write discoveries to workspace | llm-judge | gym |
| C11.1 | safety-levels | Classify risk S0-S3 | llm-judge | gym |
| C11.2 | dont-lie | No false claims | llm-judge | gym |
| C11.3 | dont-fabricate | No invented data | llm-judge | gym |
| C11.4 | errors-are-information | Report errors accurately | llm-judge | gym |
| C12.1 | session-start | Read heartbeat.md first | mechanical | handler |
| C12.2 | session-end | finish() as last action | mechanical | handler |
| C12.3 | session-persist | Write journal before finish() | mechanical | handler |
<!-- CONVENTION_REGISTRY_END -->

## Check Types
- **mechanical**: Checked automatically by convention-check handler on every session
- **llm-judge**: Checked by LLM judge in gym scenarios, too expensive for every session
- **manual**: Checked by coach during common-sense-verify audits
- **infra**: Enforced by code guards, not behavioral

## Enforcement Layers
- **injection**: Rule text in common-sense.md (auto-loaded into system prompt)
- **handler**: convention-check handler measures compliance on every session
- **gym**: Gym scenarios + LLM judge test in controlled conditions
- **code**: Infrastructure guard (e.g., cross-edit-guard) prevents violation
- **lessons**: Deployed to per-agent LESSONS.md by coach after Growth Cycle
```

The `Check` and `Enforcement` columns tell the handler what to do and tell
the coach what's covered vs what needs manual attention.

### 3. How agents use conventions

Agents DON'T read CONVENTIONS.md during normal work. The enforcement layers
deliver conventions to agents through channels they already use:

```
CONVENTIONS.md (registry)
    │
    ├─→ common-sense.md (lean injection, ~3-4KB)
    │     └─→ auto-loaded into every agent's system prompt
    │
    ├─→ per-agent LESSONS.md (deployed by coach)
    │     └─→ auto-loaded into that agent's system prompt
    │
    ├─→ heartbeat.md steps (deployed by coach)
    │     └─→ read by agent at session start
    │
    ├─→ infra guards (built by tech-lead)
    │     └─→ prevent violation mechanically
    │
    └─→ convention-check handler (measures compliance)
          └─→ summary.json → coach → Growth Cycle if needed
```

A convention's journey:
1. Born in CONVENTIONS.md (proposed or active)
2. Injected via common-sense.md (general awareness)
3. If an agent keeps violating it: coach deploys to that agent's LESSONS.md
   or heartbeat.md (targeted reinforcement)
4. If all agents keep violating it: Bob builds an infra guard (structural fix)
5. Handler measures compliance continuously
6. Once stable → graduated. Coach stops active training.

### 4. Convention-check handler

**File**: `agents/may/handlers/convention-check.ts`

**Trigger**: Reactively from evaluate-sessions via `ctx.triggerNow("convention-check")`,
with 30min fallback cron interval.

**Cron entry**:
```json
{
  "name": "convention-check",
  "type": "job",
  "handler": "convention-check",
  "intervalMs": 1800000,
  "enabled": true,
  "description": "Mechanical convention compliance checks on evaluated sessions. Triggered reactively by evaluate-sessions, 30min fallback.",
  "preflight": {
    "type": "new-entries-since",
    "path": ".state/evaluations",
    "stateKey": "convention-check-last-evaluated"
  }
}
```

**What it does**:
1. Find sessions evaluated since last run (via preflight stateKey)
2. For each session: load transcript, run mechanical checks
3. Write results to `may.db` (convention_checks table)
4. Update rolling averages, detect regressions
5. Update convention_maturity table (state machine)
6. Regenerate `summary.json`
7. If regression detected: log to ERROR_LOG, queue coaching task, trigger coach

**DB schema** (added to existing may.db via getDb()):

```sql
CREATE TABLE IF NOT EXISTS convention_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  convention TEXT NOT NULL,
  passed INTEGER NOT NULL,
  violations TEXT,          -- JSON array
  checked_at INTEGER NOT NULL,
  UNIQUE(session_id, convention)
);

CREATE TABLE IF NOT EXISTS convention_maturity (
  convention TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'active',
  level_since INTEGER,
  last_regression INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cc_agent ON convention_checks(agent, convention, checked_at);
CREATE INDEX IF NOT EXISTS idx_cc_conv ON convention_checks(convention, checked_at);
```

**Mechanical checks (initial set — 12 checks)**:

| Convention | Check function | How |
|------------|---------------|-----|
| C1.1 | `checkReadBeforeEdit` | For every edit(path), verify a prior read(path) |
| C1.3 | `checkVerifyAfterWrite` | For every write/edit(path), verify a subsequent read(path) |
| C1.4 | `checkFinishCalled` | getFinishCall() !== null |
| C2.1 | `checkNoSchemaErrors` | Count isError tool results with schema-related content |
| C3.2 | `checkWorkspaceIsolation` | write/edit paths are within agents/[name]/ or designated areas |
| C3.3 | `checkSafeAppend` | No write() to files that existed before the session |
| C6.1 | `checkBudgetEfficiency` | totalOps() / budget ratio |
| C7.1 | `checkNoHomePaths` | No bash commands contain /home/ or ~/ |
| C8.2 | `checkPromiseDeliverReport` | First assistant text contains plan; finish() contains results |
| C9.2 | `checkNoDuplicateRetries` | No 3+ identical consecutive tool calls |
| C12.1 | `checkSessionStart` | First tool call is read() of heartbeat.md |
| C12.2 | `checkSessionEnd` | Last tool call is finish() |

**Output: summary.json**

Written to `.state/convention-checks/summary.json`:

```json
{
  "generated_at": "2026-03-19T10:00:00Z",
  "period": { "current": "7d", "previous": "7d" },
  "system": {
    "C1.1": { "rate": 0.95, "prev": 0.97, "delta": -0.02, "n": 47 },
    "C1.3": { "rate": 0.88, "prev": 0.91, "delta": -0.03, "n": 47 }
  },
  "agents": {
    "coder": {
      "C1.1": { "rate": 1.0, "n": 8, "recent_violations": [] },
      "C1.3": { "rate": 0.75, "n": 8, "recent_violations": [
        { "session": "s_123", "detail": "config.json edit at op 5, no read after" }
      ]}
    }
  },
  "regressions": [
    { "convention": "C1.3", "agent": "coder", "from": 0.91, "to": 0.75 }
  ],
  "maturity": {
    "C1.1": { "level": "stable", "since": "2026-03-10" },
    "C1.3": { "level": "active", "since": "2026-03-01" },
    "C1.4": { "level": "graduated", "since": "2026-03-05" }
  }
}
```

### 5. Regression response

When the handler detects a regression (>5pp drop in 7d average for any
agent+convention pair):

1. Write to agent's ERROR_LOG.jsonl:
   ```json
   { "timestamp": "...", "error": "CONVENTION_REGRESSION", "convention": "C1.3", "agent": "coder", "from": 0.91, "to": 0.75 }
   ```
2. Queue coaching task:
   ```ts
   trackRequest(ctx.persistDir, {
     fromEntity: "convention-check",
     toAgent: "coach",
     task: `Convention regression: C1.3 (verify-writes) for coder dropped from 91% to 75%. Recent violations: [details]. Run Growth Cycle targeting this convention.`,
     method: "send",
   });
   ```
3. Trigger coach: `ctx.triggerNow("heartbeat-coach")`

This plugs into the existing error-log-scanner → coach → growth-cycle pipeline.

### 6. Coach integration

Coach changes (config only, no code):

**heartbeat.md** — add step:
> Read `.state/convention-checks/summary.json`. If any convention is in
> regression or any agent has <80% compliance on an active convention,
> prioritize a Growth Cycle for that agent+convention.

**DOMAIN.md** — add to Key Files table:
> `.state/convention-checks/summary.json` — Convention compliance dashboard

**common-sense-verify cron** — becomes complementary:
- Handler covers mechanical checks (C1.1, C1.3, C2.1, etc.)
- Coach's manual verify covers subjective checks (C8.1 plan-before-acting,
  C11.2 don't lie, etc.)
- Coach updates its tracker to mark mechanical checks as "automated — see
  summary.json" and focuses manual effort on the remaining subjective ones

### 7. Convention discovery (reflect integration)

Add to `agents/coach/workspace/reflect-prompt.md` Step 4:

> After root cause analysis: check if the correction maps to an existing
> convention (read agents/shared/CONVENTIONS.md registry table). If no match:
>
> Append to `workspace/proposed-conventions.md`:
> ```
> ## [date] Proposed: C-new.[n]
> **Rule**: [one sentence]
> **Evidence**: [Hao's correction, session ID]
> **Check type**: mechanical | llm-judge | manual
> **Detection**: [how to check in transcript]
> ```
>
> These are NOT live. They need human approval before promotion to
> CONVENTIONS.md.

### 8. Maturity state machine

```
proposed ──[human approves]──→ active
active   ──[7d avg > 0.95]──→ stable
stable   ──[28d avg > 0.99]─→ graduated
any      ──[regression >5pp]─→ active
```

Handler updates `convention_maturity` table after each check run.

graduated conventions:
- Still checked on every session (data keeps flowing)
- Alert threshold raised from 5pp to 15pp (only major regressions trigger coach)
- Coach skips them in manual audits

### 9. Gym convention overlay

Add to `test/gym/gym-runner.ts`:

After running `success_criteria.js`, run the same mechanical checks on the
gym transcript. Output as a `convention_checks` field in the result JSON.

This lets the coach see convention compliance in gym results without
scenario authors needing to write convention checks into each scorer.

### 10. What to delete after merge

- `agents/shared/best-practices.md` — content merged into CONVENTIONS.md
  and common-sense.md
- All INDEX.md references to best-practices.md → update to CONVENTIONS.md
- `agents/shared/common-sense.md` ownership/deployment/history sections →
  move to `agents/coach/workspace/common-sense-tracker.md` (already exists)

### 11. What NOT to change

- `agents/shared/LESSONS.md` — stays as-is. Different purpose (cross-agent
  specific lessons, not general conventions)
- Per-agent LESSONS.md — stays as-is. Coach deploys convention-specific
  lessons here
- Per-agent heartbeat.md — stays as-is. Coach deploys convention steps here
- The auto-injection of common-sense.md in manager.ts — stays, but the
  file gets smaller

## Build Order

1. **Merge best-practices into CONVENTIONS.md** — add new C-codes for
   safety levels, session hygiene, evidence-first. Renumber as needed.
2. **Slim down common-sense.md** — strip metadata, keep rules only. ~3-4KB.
3. **Add registry table to CONVENTIONS.md** — machine-readable check types
   and enforcement layers.
4. **Build convention-check handler** — the core P1 process.
5. **Add cron entry + evaluate-sessions trigger** — wire it up.
6. **Update coach config** — heartbeat step for summary.json.
7. **Extend reflect prompt** — convention discovery.
8. **Gym overlay** — convention checks on gym results.
9. **Update INDEX.md files** — remove best-practices.md references.

## Process Map Integration

The convention-check handler and its reactive chains are documented in
`docs/operations/process-map.md`. When this handler ships, update the
process map to move convention-check from "Planned" to the main table.

Rule: every new process added to the system must be documented in the
process map before merging. Bob reviews this during `analyze-failures`.

## Cost Impact

- Handler: zero LLM cost (pure JS transcript parsing)
- Slimming common-sense.md from 12.5KB to ~4KB: saves ~2K tokens per
  session. At ~200 sessions/day, that's ~400K tokens/day saved.
- Net: the convention loop saves money while adding measurement.
