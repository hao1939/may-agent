# Knowledge Index

All knowledge in the system, organized by confidence level.

## Verified (tested with evidence)

| ID | Claim | Evidence | Location |
|----|-------|----------|----------|
| KE-001 | Context learning works for environmental knowledge only | EXP-001 (A/B 3/3) | knowledge/entries/KE-001.md |
| KE-002 | Text rules don't fix judgment failures | 18 coach experiments, auto-evolve 0/5 | knowledge/entries/KE-002.md |
| KE-003 | Rich delegation context reduces ops by 47% | EXP-002 (POC n=5) | knowledge/entries/KE-003.md |
| KE-004 | Guards are brittle, use context.md instead | 3 guard reverts | knowledge/entries/KE-004.md |
| KE-005 | QA rubber-stamps at 14% detection | DB analysis | knowledge/entries/KE-005.md |
| KE-006 | Skills targeting reasoning patterns don't change tool-calling patterns | EXP-004 (A/B 1/3 vs 1/3) | knowledge/entries/KE-006.md |
| KE-007 | Workflow enforcement (Method #15) is the only reliable behavioral intervention | 55 experiments, 4 promoted | knowledge/entries/KE-007.md |
| KE-008 | Heartbeat step restructuring causes regression | 4/4 negative across 2 agents | knowledge/entries/KE-008.md |
| KE-009 | Negative examples in LESSONS.md have zero effect | 8 experiments, 0/8 improvement | knowledge/entries/KE-009.md |
| KE-010 | Most gym scenarios hit ceiling — agents pass at baseline | 15+ ceiling observations, 106 scenarios | knowledge/entries/KE-010.md |
| KE-011 | Knowledge files are passive — agents skip them in oneshot mode | 3 experiments, Method #6 | knowledge/entries/KE-011.md |
| KE-012 | Lab-fork null-patch test confirms infrastructure validity | Controlled zero-change test | knowledge/entries/KE-012.md |

## Adopted (in use, not experimentally verified)

### Skills (41)
Each skill is an untested hypothesis: "doing X improves agent behavior in situation Y."

| Skill | Hypothesis | Testable? | Location |
|-------|-----------|-----------|----------|
| evidence-over-narrative | Trusting runtime evidence over narrative prevents phantom fixes | Yes — gym scenario exists | skills/evidence-over-narrative/SKILL.md |
| budget-before-act | Turn-budget awareness reduces FM-3.1 non-delivery | Yes — measure delivery rate | skills/budget-before-act/SKILL.md |
| coder-edit-discipline | Reading before editing prevents wrong edits | Yes — read-before-edit scenario | skills/coder-edit-discipline/SKILL.md |
| ... | (38 more — see skills/LIBRARY.md for full list) | | |

### Workflows (7)
Structural enforcement patterns. More reliable than text rules (KE-002).

| Workflow | Purpose | Verified? | Location |
|----------|---------|-----------|----------|
| two-phase | Separate analysis from action | Gym: 92-97% pass | workflows/two-phase.ts |
| code-review-loop | Coder → QA → fix cycle with context passing | Not tested in production | workflows/code-review-loop.ts |
| evidence-gate | Check briefs for evidence before sending | Gym: 5/5 pass, 6/6 reject | workflows/evidence-gate.ts |
| context-learn | Extract knowledge from session transcripts | Deployed, LLM merge | workflows/context-learn.ts |
| reviewed-delivery | Evidence-gate before sending briefs | Not tested | workflows/reviewed-delivery.ts |
| predict-then-verify | Predict outcome, then verify | Not tested | workflows/predict-then-verify.ts |
| skill-lifecycle | Install/test/promote skills | Not tested | workflows/skill-lifecycle.ts |

### Conventions
Team behavioral rules. Adopted by convention, not verified by experiment.

| Document | Content | Lines | Testable? |
|----------|---------|-------|-----------|
| common-sense.md | How we work, think, communicate | 14 | Some items map to gym scenarios |
| CONVENTIONS.md | Behavioral conventions (C1-C13) | 140 | Each convention is testable |

## Theoretical (proposed, untested)

| Document | Content | Lines | Status |
|----------|---------|-------|--------|
| philosophy.md | Principles P1-P147+ | 323 | Many never tested. KE-002 refuted text-rule principles. |
| best-practices.md | Agent hardening practices | 73 | Overlap with skills |
| patterns/patrol.md | Patrol pattern | ~30 | Untested |
| patterns/transient-skill.md | Transient skill pattern | ~30 | Untested |

## Hypothetical (specific testable claims)

| ID | Hypothesis | Status | Location |
|----|-----------|--------|----------|
| H-001 | Adversarial QA framing increases detection from 14% to >30% | Untested | knowledge/hypotheses/H-001.md |
| H-002 | Weaker models benefit more from context.md | Untested | knowledge/hypotheses/H-002.md |
| H-003 | Verification skill improves gym pass rate on verification scenarios | Untested | knowledge/hypotheses/H-003.md |
| H-004 | Plan-once-amend skill improves blocker handling | **Refuted** | knowledge/hypotheses/H-004.md |
| H-005 | Skill utilization self-locking — worked examples unlock skill effectiveness | **EXP-005 designed** | knowledge/hypotheses/H-005.md |
| H-006 | Delegation quality is asymmetric by sender-receiver pair | Untested | knowledge/hypotheses/H-006-delegation-asymmetry.md |
| H-007 | Heartbeat architecture has a hidden coordination tax (~20-30% overhead) | Untested | knowledge/hypotheses/H-007-heartbeat-coordination-tax.md |
| H-008 | Static skills are a performance ceiling — skill annotations would break it | Untested | knowledge/hypotheses/H-008-skill-versioning.md |
| H-009 | Evaluator drift is our biggest unmonitored risk | Untested | knowledge/hypotheses/H-009-evaluator-drift.md |
| H-010 | Error amplification risk scales with agent sophistication | Proposed | knowledge/hypotheses/H-010-error-amplification.md |

## Experiments

| ID | Tests | Status | Verdict | Location |
|----|-------|--------|---------|----------|
| EXP-001 | Context learning A/B | Complete | Supported | knowledge/experiments/EXP-001/ |
| EXP-002 | Delegation context POC | Complete | Supported | knowledge/experiments/EXP-002/ |
| EXP-003 | Verification skill on verify-before-finish | Designed | — | knowledge/experiments/EXP-003/ |
| EXP-004 | Plan-once-amend skill on blocker handling | Complete | **No effect** | knowledge/experiments/EXP-004/ |
| EXP-005 | Worked examples break skill self-locking (H-005) | Designed | — | knowledge/experiments/EXP-005/ |

## Operational (not knowledge — reference only)

| Document | Purpose |
|----------|---------|
| focus-tasks.md | Current work priorities |
| roadmap.md | Long-term direction |
| SIGNALS.md | Operational signals between agents |
| daily-digests/ | Historical daily summaries |
| bulletins | Operational notices |
| tasks/ | Task templates |

## What Should Happen

1. **Skills should be hypotheses.** Each skill claims "X improves Y." Test it in the lab. If verified → knowledge entry. If not → remove or revise.

2. **Philosophy principles should be testable.** P53 "Self-Evolution Bifurcation" — is it true? Design an experiment. KE-002 already refuted some principles.

3. **Conventions should have evidence.** C1.1 "Read before edit" — does it actually prevent bad edits? The gym scenario exists. Run the experiment.

4. **The lab is the verification engine.** Everything adopted or theoretical should eventually be tested. The knowledge base tracks what's verified and what's still assumed.

## Research Library (curated, not verified)

Collected by scout, amy, amy-kimi agents. Each item is a potential source for hypotheses.

| Resource | Content | Size |
|----------|---------|------|
| library/papers.md | Academic papers with takeaways | 539 lines |
| library/repos.md | Notable GitHub repos | 899 lines |
| library/discoveries.md | Web finds (Twitter, GitHub, blogs) | 4266 lines |
| library/people.md | Notable researchers | 71 lines |
| library/reddit.md | Reddit insights | 165 lines |
| library/insights-cn.md | Curated knowledge index (Chinese) — security, architecture, agent patterns | 286 lines |
| library/deep-dives/ | Detailed research reports + cross-reference syntheses | 68 files |

See library/README.md for details. Raw archives stay agent-local.
