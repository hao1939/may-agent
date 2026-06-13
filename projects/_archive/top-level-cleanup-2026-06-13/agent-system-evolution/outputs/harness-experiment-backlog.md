# Agent Harness R&D Experiment Backlog

Ranked by expected impact × feasibility. Each card follows the R&D operating model format.

---

## 1. Evaluator Score-Batch Calibration

**Hypothesis:** Heuristic session scoring (tool-call density, evidence presence, finish-contract adherence) correlates with canonical evaluator verdicts; mismatches reveal calibration gaps.

**Minimal experiment:** Score 20 recent sessions with signal heuristics from `outputs/evaluator/signal-heuristics.md`, compare against canonical verdicts, surface disagreements.

**Evidence:** `outputs/evaluator/session-scores.jsonl`, `outputs/evaluator/patterns.md`.

**Boundary:** Evaluator calibration — rubric patches if correlation < 0.7.

**Stop condition:** Batch produced and compared; close if correlation ≥ 0.85 or if heuristics are unfixable.

**Promotion path:** Rubric patches → evaluator config; heuristic code → evaluator pipeline.

**Priority:** P0 — already running as `evaluator-score-batch-1`.

---

## 2. Receipt Quality v2

**Hypothesis:** Canonical `session.receipt` events now persist reliably, but evidence *quality* (specificity, verification linkage, deliverable accuracy) varies and affects downstream evaluation.

**Minimal experiment:** Audit 15 fresh receipt events for quality dimensions (specificity 1-5, evidence linkage boolean, deliverable accuracy boolean); compute quality distribution.

**Evidence:** Audit table in markdown; quality histogram.

**Boundary:** If mean quality < 3, propose v2 receipt contract with tighter finish-contract guidance.

**Stop condition:** Audit complete; close if quality ≥ 4 mean; escalate to contract if < 3.

**Promotion path:** v2 contract → agent prompt/convention update → platform schema tightening if needed.

**Priority:** P1 — downstream of this backlog (`receipt-quality-v2-audit` task exists).

---

## 3. Project Reconcile Behavior

**Hypothesis:** Agents sometimes create/modify tasks in projects they don't own, violating the coupling contract. A reconcile-on-finish check could catch drift before it causes cross-project confusion.

**Minimal experiment:** Grep recent sessions for cross-project task mutations; count violations; prototype a post-finish reconcile assertion that warns when an agent touches a foreign project's task list.

**Evidence:** Violation count from session logs; prototype assertion script.

**Boundary:** Agent convention (finish-contract addendum) or evaluator penalty.

**Stop condition:** If < 2 violations found in 50 sessions, deprioritize. If ≥ 5, draft convention.

**Promotion path:** Convention doc → agent system prompt injection; or evaluator rubric addition.

**Priority:** P1.

---

## 4. Metric Auto-Handler Patterns

**Hypothesis:** Agents emit metrics but rarely define automated responses (thresholds → actions). A lightweight auto-handler pattern (metric threshold → cron task or alert) would close the observe-act loop faster.

**Minimal experiment:** Identify 3 metrics that currently require manual triage; define a handler spec (threshold, action, cooldown); implement one handler using existing cron infrastructure.

**Evidence:** Handler spec doc; one working cron-triggered handler; before/after response latency.

**Boundary:** Platform request if handlers need event-bus support; agent convention if cron suffices.

**Stop condition:** One handler running for 24h without false-fires closes the experiment as validated.

**Promotion path:** Handler pattern doc → agent conventions; if cron is insufficient → platform request for event-triggered handlers.

**Priority:** P1.

---

## 5. Scout Knowledge Adoption

**Hypothesis:** Scout produces learning artifacts (`projects/scout-second-brain-learning`) that other agents don't consume. A structured adoption protocol (Scout publishes → agents subscribe via context.md facts) would increase cross-agent knowledge utilization.

**Minimal experiment:** Identify 3 Scout findings that are actionable by other agents; manually inject them as context facts for the relevant agents; measure whether those agents reference the knowledge in subsequent sessions.

**Evidence:** Before/after context.md diffs; session grep for knowledge references.

**Boundary:** Agent convention (knowledge-publish/subscribe protocol).

**Stop condition:** If 2/3 injected facts get used within 5 sessions, validate pattern. If 0/3, drop.

**Promotion path:** Convention doc defining Scout publish format + subscriber opt-in; possibly platform support for knowledge-feed subscriptions.

**Priority:** P2.

---

## 6. Cross-Agent Coordination & Delegation Patterns

**Hypothesis:** Fork/call delegation is ad-hoc; agents sometimes duplicate work or lose context across handoffs. A lightweight delegation contract (structured handoff memo, result-back protocol, dedup check) would reduce waste.

**Minimal experiment:** Audit 10 recent fork/call sessions for: context loss (child re-reads files parent already summarized), duplicate dispatch, and orphaned sessions. Quantify waste.

**Evidence:** Audit table with waste categories and counts; waste estimate in tokens/time.

**Boundary:** Agent convention (delegation memo format) or platform request (dedup guard in fork infrastructure).

**Stop condition:** If waste < 5% of audited session cost, deprioritize. If ≥ 15%, draft convention.

**Promotion path:** Delegation memo convention → system prompt; dedup guard → platform request with acceptance criteria.

**Priority:** P2.

---

## Summary Ranking

| # | Experiment | Priority | Status |
|---|-----------|----------|--------|
| 1 | Evaluator Score-Batch Calibration | P0 | Running |
| 2 | Receipt Quality v2 | P1 | Pending (task exists) |
| 3 | Project Reconcile Behavior | P1 | New |
| 4 | Metric Auto-Handler Patterns | P1 | New |
| 5 | Scout Knowledge Adoption | P2 | New |
| 6 | Cross-Agent Coordination | P2 | New |
