# Convention Library Review — 2026-03-10

## Purpose
Review each convention against actual agent behavior from evaluations and coaching sessions. Identify gaps — conventions that don't match reality, and patterns not captured by conventions.

## Method
- Analyzed 1158 evaluations (issue tag frequency analysis)
- Reviewed 15 recent coaching session reports
- Cross-referenced evaluation issues to convention IDs

---

## Convention Compliance Summary

### Structure Conventions (S1–S7)
| ID | Status | Evidence |
|----|--------|----------|
| S1 | ✅ Compliant | All agents have agent.json |
| S2 | ✅ Compliant | UPPERCASE files auto-loaded consistently |
| S3 | ✅ Compliant | knowledge/ used correctly by all agents with knowledge files |
| S4 | ✅ Compliant | workspace/ pattern followed by all active agents |
| S5 | ✅ Compliant | skills/ with SKILL.md auto-discovered correctly |
| S6 | ⚠️ Partial | Some agents don't list all knowledge/ files in DOMAIN.md |
| S7 | ✅ Compliant | UPPERCASE files generally concise |

**No convention gaps in structure.** These are well-established.

### Behavior Conventions (B1–B11)
| ID | Status | Violation Frequency | Agent(s) |
|----|--------|---------------------|----------|
| B1 | 🔴 Violated | 4 BLIND_OVERWRITE_RISK evals | Coder (false positives from transcript truncation), Optimizer (1 real) |
| B2 | 🟡 Violated | 9 VERIFICATION_GAP + 5 INSUFFICIENT_VERIFICATION | Coder (some false positives), Optimizer |
| B3 | 🟡 Violated | 5 TRUNCATED_READ evals | Coder, Coach |
| B4 | 🟡 Violated | Coach (K1/B4 overlap) — re-reading auto-loaded files | Coach |
| B5 | 🟡 Violated | 4 INSTRUCTION_VIOLATION + 2 SCOPE_CREEP | Coder, multiple |
| B6 | 🔴 Violated | 4 HALLUCINATION + 4 TOOL_HALLUCINATION | Bob (fabrication under adversity), Amy (identity confusion) |
| B7 | 🔴 Violated | 5 OUT_OF_ROOT_WRITE + 11 ERR_MODULE_NOT_FOUND | Coder, Optimizer, Scout |
| B8 | ✅ Mostly compliant | Agents generally escalate or stop | — |
| B9 | 🟡 Violated | 4 OVERCLAIMING | Multiple |
| B10 | ✅ Mostly compliant | Graduated agents use surgical edits | — |
| B11 | ⚠️ Not tested | No evaluations check for claim-before-act | — |

**Key finding:** B7 (project-relative paths) is the most frequently violated convention across agents. B6 (no fabrication) is the most severe violation type. B11 (claim before act) is not being tested by the evaluator at all.

### Knowledge Management (K1–K7)
| ID | Status | Evidence |
|----|--------|----------|
| K1 | 🟡 Violated | Coach re-reads auto-loaded files (2 eval citations). Other agents better. |
| K2 | ✅ Compliant | Todo format consistent across agents |
| K3 | ✅ Compliant | Journal append-only pattern followed |
| K4 | ✅ Compliant | [STUCK] markers used by coach and may |
| K5 | ⚠️ Partial | Not consistently applied — some items marked ✅ without proof |
| K6 | ✅ Applied | COACHEES.md split demonstrates this |
| K7 | 🔴 Relevant | Coder false positives from evaluator seeing post-compaction writes as truncated |

### Coordination (C1–C7)
| ID | Status | Evidence |
|----|--------|----------|
| C1 | ✅ Compliant | All delegation uses subagents |
| C2 | ⚠️ Partial | Coach uses delegate (blocking) when detached fails. Acceptable fallback. |
| C3 | ✅ Compliant | No sleep polling observed |
| C4 | ✅ Compliant | Chain depth generally ≤2 |
| C5 | ⚠️ Not tested | Acceptance criteria not consistently stated before decomposition |
| C6 | ⚠️ Not tested | No evidence of parallel work pivot when blocked |
| C7 | ✅ Compliant | status/result used correctly |

### Operational (O1–O8)
| ID | Status | Evidence |
|----|--------|----------|
| O1 | ✅ Compliant | cron.json in agents/may/ |
| O2 | ✅ Compliant | [cron:] prefix used |
| O3 | ✅ Compliant | Heartbeats read context, don't need external instruction |
| O4 | ⚠️ Partial | Coach sometimes does 2+ periodic tasks per heartbeat (acceptable when quick) |
| O5 | Not yet | No tasks promoted to JS cron yet |
| O6 | ✅ Compliant | Per-agent todos maintained |
| O7 | ⚠️ Aspirational | Health checks still in heartbeats |
| O8 | ✅ Applied | Coach tests before pushing to agents |

---

## Gaps: Patterns Not Captured by Conventions

### Gap 1: Sed Edit Discipline (Builder)
**Observed:** Coder HARD_CONSTRAINT_VIOLATION for using line-number sed addressing instead of pattern-based sed. This is a critical builder convention not captured.
**Proposed:** **B12: Pattern-Based Sed for Edits (Required, Builder)** — When using sed for file edits, always use pattern-based addressing (e.g., `/old_pattern/s/old/new/`), never line-number addressing (e.g., `42s/old/new/`). Line numbers shift after any file modification, making line-number edits fragile and error-prone.

### Gap 2: Correction Saturation Rule (Coach)
**Observed:** Bob adversity exercises showed that after 3 correction iterations, returns approach zero and corrections oscillate. Not captured as a convention.
**Proposed:** **O9: Correction Saturation (Required, Coach)** — After 3 correction iterations targeting the same root behavior without convergence, stop correcting. Choose: accept limitation, structural intervention, or model change.

### Gap 3: Model Upgrade Consideration (Coach)
**Observed:** QA's write() habit resolved after GPT-5.2 upgrade, not coaching. Not captured.
**Proposed:** **O10: Model Upgrade Before Extended Coaching (Recommended, Coach)** — When an agent fails 3+ exercises on a behavior, check if a model upgrade is available before investing further coaching sessions.

### Gap 4: Default Mode Awareness (All)
**Observed:** 3 agents (QA, May, Bob) have role-identity defaults that override task instructions (reviewer, delegator, completer). Pattern #6.
**Proposed:** **B13: Override Default Mode When Task Requires (Recommended, All)** — Each agent has an implicit default mode (e.g., reviewer, delegator). When a task requires a different mode (e.g., "fix the bug" requires editor mode for QA), explicitly acknowledge the mode switch.

### Gap 5: Evaluator Transcript Awareness
**Observed:** Evaluator cannot distinguish truncated transcripts from truncated agent output (pattern #8). Not a convention for agents, but an evaluator accuracy issue.
**Proposed:** Add evaluator guidance: "When tool results show truncation markers, investigate whether truncation occurred at transcript recording time vs. agent execution time before scoring."

---

## Conventions Validated by This Review (Working Well)

- **S1–S5** (structure): All agents follow the directory structure convention
- **B8** (escalate after 2): Generally working — agents don't spin endlessly
- **B10** (surgical edits): Graduated agents (Coder, QA) consistently use surgical edits
- **K2–K4** (todo format, journal, stuck markers): Consistently followed
- **C1, C3, C4, C7** (coordination basics): All working correctly
- **O1–O3, O6** (operational basics): All working correctly

## Recommendations

1. **Add B12 (sed discipline)** to behavior.md — this is the most commonly violated coding convention and is testable
2. **Add O9 (correction saturation)** to operational.md — prevents wasted coaching turns
3. **Design exercises for B1, B7, K1** as planned in todo — these are the most commonly violated conventions
4. **Don't add B13 (default mode) yet** — pattern is identified but the remedy (explicit mode switch) hasn't been validated through exercises
5. **Track B11 (claim before act) compliance** — currently not tested by evaluator. Consider adding to evaluation criteria or designing an exercise that explicitly checks for it.
