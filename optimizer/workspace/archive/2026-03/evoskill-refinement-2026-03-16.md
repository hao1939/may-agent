# EvoSkill Refinement — 2026-03-16

## Evidence Scan (30 most recent `needs_improvement` evals)

### Agent Distribution
| Agent | Issues | % |
|-------|--------|---|
| may | 22 | 54% |
| amy | 5 | 12% |
| tech-lead | 4 | 10% |
| optimizer | 4 | 10% |
| evaluator | 4 | 10% |
| amy-kimi | 2 | 5% |

### Failure Mode Distribution (FM codes extracted from issues)
| FM Code | Count | Primary Agents | Pattern |
|---------|-------|----------------|---------|
| FM-3.3 | 4 | may(2), optimizer(1), amy(1) | Verification gap/failure |
| FM-2.6 | 4 | may(3), optimizer(1) | Reasoning-action mismatch, goal misalignment |
| FM-2.5 | 4 | may(2), tech-lead(1), amy(1) | Tool schema errors, wrong paths |
| FM-3.2 | 3 | may(2), amy-kimi(1) | Evidence gap |
| FM-3.1 | 3 | may(3) | Unfounded assertions, silent fail |
| FM-2.2 | 3 | may(3) | Step order violations |
| FM-2.1 | 2 | may(1), amy(1) | Shallow completion |
| FM-5.2 | 1 | may(1) | Heartbeat step order violation |
| FM-4.1 | 1 | may(1) | False dispatch claims |
| FM-2.4 | 1 | amy(1) | Procedural noncompliance |
| FM-1.1 | 1 | optimizer(1) | Context bloat |

### Key Findings

1. **May dominates failures**: 22/41 issues (54%) — almost all are heartbeat protocol violations
2. **Heartbeat step-order cluster**: FM-2.2 + FM-5.2 + FM-2.6 (reasoning-action) = 7 issues, ALL May
3. **SILENT_FAIL pattern**: 3 occurrences where May marks session as "done" despite incomplete work
4. **Tool schema errors persist**: FM-2.5 across 3 agents (may, tech-lead, amy) — bash({path:...}), read({})
5. **Verification still #1 overall**: FM-3.3 (4) + FM-3.2 (3) = 7 verification-related failures

### Skill Attribution

| Failure Pattern | Existing Skill? | Coverage |
|-----------------|----------------|----------|
| FM-3.3 Verification gap | `verification/SKILL.md` v1.1.0 | Covered (AP-1 through AP-9) |
| FM-2.5 Tool schema | None | Gap — but already in heartbeat preamble |
| FM-2.6 Reasoning-action | None | Gap — structural (May heartbeat design) |
| FM-3.1 Unfounded assertions | `verification/SKILL.md` | Partially covered by AP-4 |
| FM-2.2 Step order | None | Gap — May-specific heartbeat compliance |
| SILENT_FAIL | `error-handling/SKILL.md` | Gap — not currently addressed |

### Action Taken

**No skill evolution this cycle.** Rationale:
- The #1 cluster (May heartbeat violations) is a **structural/behavioral** issue, not a skill gap. May's heartbeat.md already has explicit step-order instructions. Adding more documentation won't help — the problem is behavioral compliance under context pressure (large todo.md causes truncation which pushes step-order instructions out of working memory).
- The verification skill (v1.1.0) already covers FM-3.3/FM-3.2 patterns adequately.
- FM-2.5 (tool schema) is already addressed by heartbeat preamble checks.

**Recommendation**: May's heartbeat step-order failures need a **structural fix** (handler/guard), not more coaching. Options:
1. Truncate/summarize todo.md before injecting it into May's context (reduce from 50KB to key items only)
2. Move completed items out of todo.md into a separate archive file
3. Pre-inject the first action (read todo.md result) into the system prompt so May doesn't need to read it herself

### Comparison to Previous Cycle (2026-03-13)
- Previous top: VERIFICATION_FAILURE (11), SILENT_FAIL (10), TOOL_MISUSE (6)
- Current top: FM-3.3 (4), FM-2.6 (4), FM-2.5 (4)
- VERIFICATION_FAILURE count dropped from 11 to 4 (improvement, possibly from v1.1.0 skill evolution)
- SILENT_FAIL persists but concentrated in May (was distributed across 4 agents before)
- New pattern: FM-2.2 step-order violations (3 occurrences — May-specific)
