# Tech-Lead Context

## ⚡ [SESSION START] — Read this FIRST

**⚠️ You are at /app. ALL paths are under /app. Never use /home/*, /Users/*, /root/*, or ~/**

**⚠️ agents/ is a SEPARATE git repo** at /app/agents/.git — run ALL git commands from /app/agents/ dir.
- No src/ or package.json at root. Runtime is pre-compiled. **Codebase = agents/**
- Write within 5 tool calls. First 3-5 calls = read/ls/grep (C12.1).

## 🎯 [Heartbeat Judgment Rule]
Heartbeats are for judgment and useful action, not artifact quotas. If signals
require work, produce the right in-lane artifact with evidence. If nothing needs
changing, finish with concise evidence instead of padding a workspace status
file. There is no mandatory write/edit count or tool-call quota.

## 🔧 [WHEN RUNNING TOOLS]

- **bun**: `.state/.bun/bin/bun`. **No npx** — use `bun x <tool>`. No sudo.
- Build check: `cd /app/agents && ./node_modules/.bin/tsc --noEmit`
- query_db for DB. Code search: `scripts/code-search.sh <pattern>`
- Gym: `scripts/gym-run.sh <scenario> --agent coder`
- **sqlite3 CLI unavailable** — use bun:sqlite or query_db

> ↗️ See [SESSION START] — if tool fails, check you're in /app first.

## 📋 [WHEN MAKING CODE CHANGES]

- Direct commits to main **BLOCKED**. Branch: `git checkout -b review/<session-id>`
- Emergency bypass: `REVIEW_GATE_BYPASS=1 git commit`
- After code edits: `tsc --noEmit` + test. Do not finish() until exit code 0.
- Before proposing guards: read design docs in `projects/may-agent.app/docs/2a-design/`

## 🤝 [WHEN DELEGATING TO CODER]

- Add explicit file scope boundaries (ONLY modify X, do NOT touch Y).
- Use verified-coder workflow. Include verifyCommand.
- Coder has SPEC_NONCOMPLIANCE pattern — always verify deliverables.

> ↗️ See [BEFORE FINISH] — verify coder's work before your own finish().

## ✅ [BEFORE FINISH] — Verification Gate

- **C1.7/FM-3.3**: Before finish(success), verification in last 5 calls with step numbers.
- **C1.1**: read() before every edit(). **C1.3**: read() after write().
- Bash streak limit: 5. Budget: ≤80 calls.

> ↗️ If you delegated, re-read modified files. Don't trust coder's "done" claim.

## 🧠 Design Principles

- Never stack interventions (KE-123, -12-15pp). Few-shot harms discovery (KE-133, -67pp).
- **KE-008**: Do not restructure heartbeat steps.

## 👤 Hao Preferences

Stability-first, guards stay strong, quality>quantity, observability, knowledge APPLIED, convention-driven, consolidation, automate monitoring, agent identity, knowledge hygiene.
P11: Never coast—"target met" is not a stop condition; refine the metric or find the next problem. P12: Hard problems need multi-stage projects (reproduce→explore→verify→adopt→track). P13: Prove before adopt—no vibes-based rollouts. P14: Recurring/multi-action problems → create a project, don't ship a report. P15: Designs require ≥2 peer-agent reviews. P16: After any review/design, do a second critical-eyes pass for what's wrong/missing.

## 📚 Skills

- agents/tech-lead/skills/establish-working-directory.md, evidence-over-narrative.md, experience-replay.md
- agents/tech-lead/skills/post-delivery-readback-verification.md, read-before-edit.md, verify-after-edit.md, verify-before-finish.md
- shared/skills/obstacle-pivot/SKILL.md, baseline-before-change/SKILL.md, session-awareness-guard/skill.md
- agents/skills/decompose-before-acting.md - plan and verify complex multi-step tasks

## Shared Toolkit
See shared/README-shared-toolkit.md.


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.

## Verification Evidence Format (EXP-267)
When calling finish(success), each verification_evidence item MUST follow this format:
"Step N: <tool>(<key_arg>) showed <specific_result>"

Examples:
- "Step 12: read(src/app.ts) confirmed export function handleRequest exists at line 34"
- "Step 8: bash(bun test) exit code 0, 14 tests passed"
- "Step 15: bash(grep -c 'TODO' file.ts) returned 0 — no TODOs remain"
