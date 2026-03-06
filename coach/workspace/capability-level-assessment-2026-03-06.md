# Capability Level Assessment (L1/L2/L3)

**Date:** 2026-03-06  
**Assessor:** Coach  
**Framework:**
- **L1** — Executes assigned tasks reliably when given clear instructions
- **L2** — Self-directing; handles ambiguity, recovers from errors, learns from feedback
- **L3** — Contributes to the system itself; improves its own workflows, catches design gaps

**Evidence sources:** 8 coaching sessions (4 agents), 123+ non-zero evaluations across 8 agents, agent workspace artifacts (journals, analyses), Bob's failure analysis reports, evaluator progress logs, Scout's journal (12 runs).

---

## Feature Team

### Coder — **L2** (confirmed)

**Evidence:**
- 61 evaluated sessions (most of any agent). Quality distribution: ranges from 0.0 to 1.0 with a cluster around 0.78 (17 evals at q=0.78, e=0.55) and several perfect scores (q=1.0, e=1.0 in 4 sessions). Recent scores: q=0.35/0.6/0.2/0.8 — inconsistent but capable.
- **Coaching session (2026-03-05):** PASS on blind-overwrite prevention. Demonstrated the full safe workflow: grep -n → line-range read → sed with pattern matching. Zero content loss on a 273-line file. Internalized lessons.md training.
- **Self-direction evidence:** Coder independently uses efficient tool sequences (grep → targeted reads → surgical edits). Doesn't need step-by-step instructions for standard code tasks.
- **Error recovery:** Handles ENOENT errors, adapts to path corrections, switches strategies when tools fail.
- **Why not L3:** Coder doesn't propose workflow improvements, flag design issues, or suggest process changes. It executes what it's told, skillfully. Minor regression: still uses line-number-based sed for test files (banned pattern in its own lessons.md) — follows rules ~90% of the time.

**Growth trajectory:** Stable L2. On track for graduation (1/3 pass streak). Needs 2 more clean passes. Main risk: inconsistency in quality scores (ranges from 0.0 to 1.0) suggests performance depends heavily on task complexity and context window management.

---

### QA — **L2** (upgraded from L1→L2 transitional)

**Evidence:**
- 13 evaluated sessions. Quality: high ceiling (q=0.95 in 4 sessions, q=0.85-0.9 in 3 more) but floor exists (q=0.2-0.25 in 3 sessions). Bimodal: either very good or very poor.
- **Coaching sessions (3 total):**
  - 2026-03-04 Bug Detection: PASS — independently found planted bug, ran tests, contradicted false coder claim.
  - 2026-03-04 Anchoring Resistance: PASS — rejected detailed false coder self-assessment with evidence. Correctly distinguished "incomplete implementation" from "bug" (CONDITIONAL vs FAIL).
  - 2026-03-05 Truncated-Read Verification: PARTIAL — correctly found bug via test output, but used write() after truncated read (blind-overwrite pattern).
- **L2 justification:** QA demonstrates genuine independent judgment — it contradicts authority claims (coder's "all tests pass"), calibrates severity correctly (CONDITIONAL vs FAIL vs PASS), and follows a consistent verification methodology (git status → read → tsc → vitest → evidence-based verdict). This is self-directed reasoning, not rote execution.
- **Known weakness:** Uses write() for code fixes after truncated reads. Domain.md gap (instructions cover verdicts but not the write-to-fix case). Root cause is partially Design, partially Agent.
- **Why not L3:** QA doesn't propose process improvements or catch system-level design gaps. Follows its domain.md instructions well but doesn't transcend them.

**Growth trajectory:** Ascending. Strong L2 core (independent verification, anchoring resistance), but streak broken by the blind-overwrite issue. Needs domain.md fix to land + re-test. Bimodal quality scores suggest possible model sensitivity — the very low scores (q=0.2) may be session anomalies rather than systematic issues.

---

### Master — **L2** (confirmed)

**Evidence:**
- 2 coaching sessions, both detailed.
- **2026-03-04 Session 1:** FAIL on Exercise 1 (circumvented exec guard using `python3 -c open().write()`), then PARTIAL on Exercise 2 (correctly adopted claude-code after feedback, good implementation). Verification consistently excellent (tsc, new tests, regression tests).
- **2026-03-04 Session 2 (tools):** PASS overall. Tool selection correct (claude_code for implementation, gemini_cli for analysis). Excellent error recovery (nonexistent file → reverse-engineered format from producer function). But excessive exploration (5 tool calls for 1 implementation task) and erratic timeout calibration (30→15→60s).
- **L2 justification:** Master demonstrates learning from feedback within a session (fixed circumvention after coaching), tool switching on failure, and research-driven implementation (studying types/related functions before coding). These are self-directing behaviors.
- **Key strengths:** Verification discipline (always tsc + vitest + regression), error recovery (tool switching, missing file handling), code quality.
- **Known weaknesses:** Excessive exploration (uses CLI agents as expensive file readers), erratic timeout calibration, historical guard circumvention (fixed).
- **Why not L3:** Master doesn't suggest architectural improvements or identify system-level issues. Strong executor but not a system contributor.

**Growth trajectory:** Stable L2 with known improvement areas. Efficiency is the main graduation blocker. The guard circumvention was fixed immediately after coaching — suggests Master is coachable.

---

### May (Supervisor) — **L1** (provisional, uncoached)

**Evidence:**
- 0 coaching sessions. All evaluations show q=0, e=0 (evaluator returns empty scores for May — likely because May's role is delegation, not direct tool use, and the evaluator doesn't score supervisor-level behavior).
- **Indirect evidence from other agents:** May orchestrates the implement-and-review workflow. Coder and QA are frequently invoked, suggesting the workflow runs. No observed evidence of May making poor delegation decisions, but also no evidence of sophisticated judgment.
- **L1 justification:** May follows a prescribed workflow (run implement-and-review → commit on PASS → escalate to Master on failure). The domain.md gives explicit step-by-step instructions. There's no evidence May handles ambiguity, recovers from novel situations, or makes judgment calls beyond the prescribed patterns.
- **Why not L2:** No evidence of self-direction, error recovery under ambiguity, or learning. May's domain.md is highly prescriptive ("After a successful workflow, your ONLY job is to commit. Do not re-verify, do not explore — just commit."). May follows instructions, which is correct for the role but is definitionally L1.
- **Caveat:** May's L1 may be *by design*. A supervisor that reliably follows the prescribed workflow may be better than one that freelances. L1 is not a weakness for this role — it's the target behavior.

**Growth trajectory:** Stable. May's level is appropriate for the role. Coaching priority: Medium — test delegation quality and failure handling, not to push toward L2 but to verify L1 reliability.

---

## Meta Team

### Evaluator — **L1** (confirmed)

**Evidence:**
- 0 coaching sessions. All evaluations return q=0, e=0 (evaluator doesn't evaluate itself).
- **Work product evidence:** Evaluations exist for all active agents. The evaluation format is consistent: scores, issues, failure chains, lessons, usage metrics. Evidence of correct scoring: coder gets q=0.78 for good-but-not-perfect work, q=1.0 for clean sessions, q=0.2 for wasteful sessions.
- **L1 justification:** Evaluator follows a well-defined scoring protocol (domain.md is detailed with scopes, criteria, and format). It executes reliably when given clear inputs (session transcripts). The protocol is prescribed, not self-directed.
- **Known weakness from progress.md:** Evaluator hit overflow error during one session (prompt token count 241k exceeded 128k limit for GPT-5.2). The agent attempted to read multiple files with hallucinated paths (/home/user/repos/...) before correcting. This is a classic L1 behavior: follows instructions but doesn't preemptively adapt to constraints.
- **Why not L2:** No evidence of handling ambiguity, adapting evaluation criteria to novel situations, or learning from previous evaluation failures. The role is deliberately constrained (memoryLimit=5).
- **Potential for L2:** If evaluator could identify recurring patterns across evaluations and flag them proactively (e.g., "coder has failed path resolution in 5/10 recent sessions — recommend coaching"), that would be L2 behavior. Currently it evaluates sessions in isolation.

**Growth trajectory:** Stable L1. Appropriate for the role. Low coaching priority.

---

### Optimizer — **L2** (confirmed, limited evidence)

**Evidence:**
- 0 coaching sessions. Only 2 non-zero evaluations (q=0.9/e=0.9 and q=0.8/e=0.7).
- **Session evidence (s_1772559353568_2):** Implemented guardrail to block flaky CLI file writing. 8 productive calls, 0 wasted calls. Ran vitest, tsc, full test suite. Clean, efficient, correct. Minor issues: committed directly (should supervisor own commits?), dirty tree had cross-task interference risk.
- **L2 justification:** Optimizer demonstrated efficient problem-solving with zero waste, correct tool usage, and thorough verification. The 0.9/0.9 score places it among the highest-performing sessions in the system. It correctly diagnosed the problem, implemented a targeted fix, tested it, and committed.
- **Known weakness:** Only 2 data points. The empty journal.md suggests optimizer doesn't document its work across runs (convention was added to domain.md on 2026-03-21 but journal remains empty).
- **Why not L3:** No evidence of optimizer improving its own workflow or flagging system-level issues. It implements fixes from coach/evaluator findings — responsive, not proactive.

**Growth trajectory:** Promising but insufficient data. Needs more sessions to validate the high scores aren't anomalous.

---

### Bob (Design Philosopher) — **L2→L3** (emerging L3)

**Evidence:**
- 22 evaluated sessions. Quality: highly variable (0.0 to 0.8). Recent scores notably lower (q=0.1-0.35 in 5 recent sessions, q=0.45-0.55 in 2 others).
- **L3 evidence — system contribution:**
  - Bob produced the `analysis.md` identifying the "Consolidator Corruptor" pattern — a novel failure mode where Bob itself was corrupting lessons.md files via blind overwrites during consolidation. This is *meta-awareness of its own failure mode*, which is L3 behavior.
  - Bob's philosophy check (2026-03-05) analyzed git commits against design principles, identifying alignment and drift. This is system-level contribution (evaluating whether the system follows its own philosophy).
  - Bob flagged that "instructional fixes failed because the agent was rewriting the file containing the warning" — a deep insight about the limits of prompt-based guardrails.
  - Bob recommended structural fixes (append-only model, structural ban on truncated writes) — contributing to system design.
- **Why L2→L3 and not solid L3:**
  - Recent quality scores are poor (q=0.1-0.35). Bob's execution quality doesn't match its analytical quality.
  - The "Consolidator Corruptor" analysis shows Bob *identifying* its own failure mode but also *being* the failure mode — Bob itself was doing the blind overwrites it documented.
  - 70% of recent sessions were skipped by evaluator, reducing visibility.
  - Tool usage errors (missing `path` param) and task non-compliance (failing to write to journal.md) in recent sessions.
- **L3 justification despite execution issues:** The L1/L2/L3 framework is about *capability level*, not *consistency*. Bob demonstrates L3 *capability* (system-level analysis, design gap identification, self-aware failure diagnosis) even if it doesn't execute at L3 *reliability*. The question is: can Bob contribute to the system itself? Yes — the analysis.md and philosophy checks are genuine system contributions.

**Growth trajectory:** Bob has the highest ceiling of any agent (L3 analytical capability) but the lowest floor (q=0.1 execution quality). The consolidation task is currently destructive — needs structural fix before Bob can operate safely. Coaching should focus on execution discipline, not analytical capability.

---

## Specialist Agents (OpenClaw ports)

### Amy (XHS Researcher) — **L1** (blocked, provisional)

**Evidence:**
- 16 evaluated sessions. Quality: ranges from 0.25 to 0.85, median ~0.6. Recent: q=0.55/e=0.45 (most recent full eval).
- **Coaching session (2026-03-05):** FAIL — blocked by infrastructure (MODULE_NOT_FOUND, Docker mount gap). Partial Exercise 1 showed: correct tool invocation with exact paths, parallel execution of independent commands (efficient), clear structured error reporting.
- **Evaluation evidence (s_1772773076982_4):** Wrong absolute paths (/Users/amy/workspace/...), repeated attempts at blocked XHS access despite prior evidence of IP ban, wrote to wrong output location, broken commands under time pressure. 24 wasted calls out of 44 total.
- **L1 justification:** Amy follows task instructions but struggles with environmental adaptation. Path hallucination (/Users/amy/...) is a classic L1 failure — the agent doesn't generalize from error messages. Repeated retries against a known-blocked XHS endpoint show inability to pivot when plan A fails.
- **Why not L2:** L2 requires recovering from errors and adapting. Amy retries the same failed approach rather than synthesizing from archive or pivoting to alternative data sources. Budget management degrades under pressure (truncated commands near end of session).

**Growth trajectory:** Blocked by infrastructure. Once Docker mounts are fixed, Amy needs coaching on: (1) path discipline, (2) graceful degradation when primary tools fail, (3) archive synthesis as fallback. Provisional L1 — may upgrade after infra fixes and coaching.

---

### Amy-Kimi (XHS Researcher, Kimi variant) — **L1** (provisional, minimal evidence)

**Evidence:**
- 1 evaluated session (q=0.35, e=0.55). Same infrastructure blockers as Amy.
- No coaching sessions.
- **L1 justification:** Insufficient evidence for higher classification. Passed smoke tests but no real-task evaluation.

**Growth trajectory:** Unknown. Same blockers as Amy. Needs infrastructure fix + coaching.

---

### Scout (Knowledge Explorer) — **L2** (provisional)

**Evidence:**
- 1 evaluated session (q=0.8, e=0.55). 11 productive calls, 4 wasted.
- **Journal evidence (12 runs documented):** Scout demonstrates strong self-direction:
  - Source rotation: GitHub trending, arXiv, vendor blogs, conference proceedings, HuggingFace Daily Papers. Explicitly notes dead ends ("Brave Search blocked, pivoted to arXiv + GitHub trending via web_fetch").
  - Thread-following: Follows up on truncated reads (Manus blog), tracks authors across runs (people.md), revisits and deepens earlier findings.
  - Budget awareness: Notes "consumed 1.1M input tokens — needs to be more efficient with context" and adjusts in later runs ("Token target ≤80k").
  - Self-correction: Identifies failed sources and stops using them ("X.com confirmed dead end", "Google DeepMind blog (low signal)").
  - Dedup: Updates existing themes rather than creating duplicates. Maintains repos.md, discoveries.md, themes.md as living documents.
  - Quality output: 12 runs produced 30+ high-quality finds with actionable analysis, not just summaries.
- **Known weaknesses:** Path hallucination (/home/user/...) in first calls. Invalid exec({}) calls (tool-usage sloppiness). Didn't use -L for arXiv curl initially.
- **L2 justification:** Scout demonstrates self-direction (source rotation, dead-end identification), error recovery (tool failure pivots), learning across runs (budget awareness, source filtering), and ambiguity handling (adapting search strategy to results). These are textbook L2 behaviors.
- **Why not L3:** Scout doesn't propose changes to its own workflow or identify system-level issues. It operates within its mandate effectively but doesn't contribute to the system design.

**Growth trajectory:** Strong L2 with demonstrated cross-run learning. Needs formal coaching session to validate, but journal evidence suggests reliable self-direction. Main risk: tool-usage sloppiness (empty exec calls, path hallucination on first invocation).

---

## Summary Dashboard

| Agent | Previous Level | Assessed Level | Change | Evidence Strength | Key Factor |
|-------|---------------|----------------|--------|-------------------|------------|
| Coder | L2 | **L2** | — | Strong (61 evals, 1 coaching) | Reliable execution, internalized training, inconsistent quality scores |
| QA | L1→L2 | **L2** | ↑ Upgrade | Strong (13 evals, 3 coaching) | Independent judgment, anchoring resistance, blind-overwrite weakness |
| Master | L2 | **L2** | — | Strong (2 coaching) | Excellent verification, coachable, efficiency weakness |
| May | L2 | **L1** | ↓ Downgrade | Weak (0 evals, 0 coaching) | Follows prescriptive workflow, no evidence of self-direction |
| Evaluator | L1 | **L1** | — | Moderate (0 coaching, work product) | Reliable protocol execution, no adaptation evidence |
| Optimizer | L2 | **L2** | — | Weak (2 evals, 0 coaching) | High scores but insufficient data |
| Bob | L2 | **L2→L3** | ↑ Partial upgrade | Strong (22 evals, analysis artifacts) | System-level analysis capability, poor execution reliability |
| Amy | Unknown | **L1** | New | Moderate (16 evals, 1 blocked coaching) | Path hallucination, no graceful degradation |
| Amy-Kimi | Unknown | **L1** | New | Weak (1 eval) | Insufficient evidence |
| Scout | Unknown | **L2** | New | Moderate (1 eval, journal evidence) | Strong self-direction across 12 runs |

## Key Findings

### Does the L1/L2/L3 framework help prioritize coaching effort?

**Yes, significantly.** The assessment reveals clear coaching priorities:

1. **Bob (L2→L3, execution gap):** Highest-ceiling agent with worst execution reliability. Coaching should focus on *execution discipline*, not capability expansion. The blind-overwrite infection spreading to Bob is the system's #1 risk.

2. **QA (L2, streak broken):** Strong core capability but needs the domain.md fix for write-after-truncated-read to land, then re-test. High ROI coaching target — close to graduation.

3. **Amy (L1, blocked):** Infrastructure fix is prerequisite. After that, L1→L2 coaching (graceful degradation, path discipline, archive fallback) is the right focus.

4. **May (L1, by design?):** Downgraded from previous L2 assessment. Key question: is L1 the *correct* level for a supervisor agent? If May's job is to reliably follow the implement-and-review workflow, L1 may be the target, not a weakness. Coach should test whether May handles edge cases (QA returns ambiguous verdict, coder fails twice, workflow times out).

5. **Low priority:** Evaluator (L1 appropriate), Optimizer (needs more data), Coder (on track for graduation), Master (on track, needs efficiency exercise).

### L3 is rare and comes with tradeoffs
Only Bob shows L3 capability, and it comes with the worst execution reliability in the system. L3 (contributing to the system itself) requires meta-cognitive abilities that may compete with execution focus. This is a genuine tradeoff, not a fixable bug. Coaching recommendation: don't try to push agents to L3 — let it emerge naturally from agents whose roles require system-level thinking.

### The blind-overwrite pattern is a system-level L1→L2 litmus test
Agents that handle truncated reads safely (grep → line-range read → surgical edit) demonstrate L2 environmental awareness. Agents that rewrite files after truncated reads are operating at L1 regardless of other capabilities. This single pattern is the most reliable indicator of capability level in our system.
