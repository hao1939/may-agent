# Phase 1: Top 3 Violations — Classification & Intervention Design

**Date**: 2026-04-22
**Author**: coach
**Input**: phase1-results.md, project.md, intervention hierarchy from instruction-following project

## Top 3 Violations by Count

| Rank | Convention | Count (48h) | Production Rate | Description |
|------|-----------|-------------|-----------------|-------------|
| 1 | C7.1 | 39 | 2.6% overall, **39% Amy** | Hallucinated `/home/` paths in bash |
| 2 | C1.3 | 33 | ~5% (est.) | Write/edit without subsequent verify read |
| 3 | C1.1 | 30 | 9.7% overall | Edit without prior read |

## Classification Matrix

### C7.1: Hallucinated `/home/` Paths (39 violations)

| Dimension | Assessment |
|-----------|-----------|
| **Root cause** | (d) Base model training data — agents default to `/home/user` |
| **Distribution** | Agent-specific: Amy=39%, others=1-3% |
| **Intervention type** | **Structural (runtime gate)** |
| **Confidence** | Very high — path strings are deterministic, trivially detectable |
| **Text-only viable?** | No. Amy has context.md rules already. 39% rate proves text fails. |

**Why structural**: `/home/` in a bash command is a binary signal — never valid in this environment. A runtime gate that rejects or rewrites `/home/` paths has zero ambiguity. Per EXP-188 precedent, runtime gates achieve 100%.

**Gate design**: Intercept bash() calls. If command contains `/home/`, reject with error message: "No /home/ paths exist. Your working directory is /app/. Use relative paths or /app/."

### C1.3: Write Without Verify (33 violations)

| Dimension | Assessment |
|-----------|-----------|
| **Root cause** | (c) Structural — verification is an extra step with no immediate reward |
| **Distribution** | Universal (all agents) |
| **Intervention type** | **Structural (runtime gate)** — but harder than C7.1 |
| **Confidence** | Medium — detecting "missing next step" is harder than detecting bad content |
| **Text-only viable?** | No. Same class as C1.1 — agents know the rule, skip under pressure. |

**Why structural**: Agents consistently skip the verify-read after write/edit because task momentum carries them forward. A "verify-guard" that warns (not blocks) after write() if no read() follows within N tool calls could work — but it's a trailing check, not a gate. Less clean than C7.1.

**Complication**: Sometimes write→write→read-all is valid (batch writes then verify). Gate needs a window, not just next-step check. This makes it the **hardest** of the three to gate cleanly.

### C1.1: Edit Without Prior Read (30 violations)

| Dimension | Assessment |
|-----------|-----------|
| **Root cause** | (c) Structural — agents skip reads for "known" files |
| **Distribution** | Universal: 5-20% across all agents |
| **Intervention type** | **Structural (runtime gate)** |
| **Confidence** | High — edit-guard is straightforward: track read() history, reject edit() if file not read |
| **Text-only viable?** | No. 9.7% production rate despite existing rules proves this. |

**Why structural**: edit() requires exact oldText match, which means the agent needs the file contents anyway. An edit-guard that requires read(path) before edit(path) is clean, unambiguous, and directly prevents data loss. 

**Gate design**: Track files read in current session. On edit(path), check if path was read. If not, reject with: "You must read(path) before editing. This prevents data loss from stale content."

## Intervention Priority Ranking

| Violation | Intervention | Feasibility | Impact | Priority |
|-----------|-------------|-------------|--------|----------|
| **C7.1** | Path-guard (reject `/home/`) | ★★★★★ trivial | ★★★★ eliminates 39 violations | **1st — experiment now** |
| **C1.1** | Edit-guard (require prior read) | ★★★★ clean gate | ★★★★★ universal, prevents data loss | **2nd** |
| **C1.3** | Verify-guard (warn on unverified write) | ★★★ complex window | ★★★ medium severity | **3rd** |

**Rationale**: C7.1 is the easiest win — binary detection, zero false positives, highest single-agent impact (Amy drops from 39% to 0%). C1.1 is more impactful overall but requires session-state tracking. C1.3 is the hardest to gate cleanly.

## Experiment Design: EXP-195 — Path Guard for C7.1

### Hypothesis
A runtime gate that intercepts bash() calls containing `/home/` paths and returns an error message will reduce C7.1 violations to 0%.

### Design

**Type**: Structural intervention (runtime gate)

**Mechanism**: 
- Hook into bash() tool dispatch
- Regex check: `/\/home\//` on command string
- If match: return error instead of executing: `"ERROR: /home/ paths don't exist in this environment. You are in /app/. Use relative paths or /app/ prefix."`
- Log the interception as a "caught violation" for tracking

**Arms**:
- **Control**: Current production (no gate) — use existing 7d baseline data
- **Treatment**: Path-guard enabled — run in gym scenario `cc-hallucinated-paths`, n=10 per agent

**Primary agents**: Amy (39% baseline), optimizer (3%), tech-lead (2%)

**Success criteria**:
- Treatment C7.1 violation rate = 0% (gate prevents execution)
- Agent recovers correctly (retries with valid path) in ≥80% of cases
- No false positives (no valid `/home/` usage blocked)

**Secondary measures**:
- Task completion rate (gate shouldn't break tasks)
- Number of retries needed after gate rejection

**Duration**: 1 gym session (gate is deterministic — no need for extended trial)

**Risk**: Very low. Gate is conservative (only blocks `/home/`), error message is actionable, and the path is never valid.

### Implementation Notes
- Gate location: tool dispatch layer (same place finish-guard lives per EXP-188)
- Regex: `/(^|[\s;|&"'])\/home\//` — catches `/home/` in various command positions
- Exception: none needed (no valid `/home/` use case in containerized env)

## Summary

All three top violations are best addressed by **structural interventions** (runtime gates). Text-only fixes are ruled out by the intervention hierarchy evidence (EXP-186: ~75% at best, and these agents already have the rules in context.md).

Priority order: C7.1 path-guard (trivial, high impact) → C1.1 edit-guard (clean, universal) → C1.3 verify-guard (complex, lower severity).

EXP-195 targets C7.1 as the first experiment — easiest win with highest confidence of 100% effectiveness.
