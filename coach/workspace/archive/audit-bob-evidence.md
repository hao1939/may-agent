# Audit: Bob's Briefs — Evidence-First Practice

**Auditor**: Coach  
**Date**: 2026-03-27  
**Scope**: All 47 briefs/designs/reviews/directives in `agents/bob/workspace/sent/`  
**Excluded**: `SOUL.compact.md` (config file, not a brief)

## Scoring Key

- **evidence-backed**: Cites real data (session failures, grep output, gym results, error counts, prior experiments) before proposing a system
- **theory-first**: Proposes architecture/framework without validating the core assumption
- **mixed**: Some evidence but jumps to system design prematurely

---

## 1. Audit Table

| # | Brief | Score | Notes |
|---|-------|-------|-------|
| 1 | `2026-03-24-brief-deploy-fm3.3-guard.md` | evidence-backed | Cites FM-3.3/C26 as established failure mode. Solution is deployment of an already-built tool — operational, not speculative. |
| 2 | `2026-03-24-brief-infra-ghost-deliverables.md` | evidence-backed | Cites FM-3.1 as "#1 behavioral failure mode." References existing detective control (convention-check) and Tech-Lead's prior work. Proposes a targeted guard. |
| 3 | `2026-03-24-brief-scout-prompt-simplification.md` | mixed | Cites "20+ tool calls with 0 verification citations" (real data). But the link between "legacy prompt" and drift is assumed, not measured. No baseline comparison before proposing the switch. |
| 4 | `2026-03-25-brief-auto-evolve-experiment.md` | evidence-backed | Cites specific baseline ("currently failing 3/13 smoke scenarios"). Proposes a controlled experiment (5 variations, gym as fitness function). Good experimental design. |
| 5 | `2026-03-25-brief-deploy-fm3.3-guard-remainder.md` | evidence-backed | Cites specific gap: "4 agents remain unprotected." Operational rollout of an existing guard. Minimal design, maximum action. |
| 6 | `2026-03-25-brief-gym-verification-scenario.md` | evidence-backed | Cites FM-3.3 pattern. Includes specific failure mode examples (eye-balling, lie, omission). Scenario design is concrete with setup scripts and verifier logic. |
| 7 | `2026-03-25-brief-require-verification-evidence.md` | mixed | Cites `analysis.md` as evidence of FM-3.3 pattern. But the schema design is speculative — includes a self-correction mid-doc ("We don't have strict tool output IDs yet"). No POC or experiment proposed before the full implementation. |
| 8 | `2026-03-26-brief-migrate-coach-archetype.md` | evidence-backed | References an existing archetype system already piloted with coder. Small, concrete migration task. No speculative design. |
| 9 | `brief-auto-evolve-experiment.md` | evidence-backed | Same experiment as #4 but coach-facing. Cites "3/13 smoke" baseline. Structured protocol (generate → run → analyze). |
| 10 | `brief-auto-evolve-try2.md` | evidence-backed | Cites "currently ~10/13" baseline. Specifies 5 concrete variation hypotheses. Includes actual script. Experiment-first. |
| 11 | `brief-fix-context-loading.md` | evidence-backed | Cites grep evidence: "12 agents have DOMAIN.md files that are currently ignored." Cites `grep -L "Verification Discipline"` output. Precise diagnosis. |
| 12 | `brief-fix-context-loading-v2.md` | evidence-backed | Same as #11, more compact. Evidence referenced. |
| 13 | `brief-gym-verification-scenario.md` | evidence-backed | Cites FM-3.3 pattern. References the deployed `finish()` guard as context. Clear gap analysis: "Guard blocks but doesn't teach." |
| 14 | `brief-implement-archetypes.md` | mixed | Cites prior work (diff verification, agent-loader.ts code reading). But includes a long "Wait..." reasoning chain about prompt loading that's live debugging, not pre-gathered evidence. The core assumption ("archetype inheritance reduces regression") is untested. |
| 15 | `brief-migrate-lessons.md` | evidence-backed | Cites specific evidence: "agents/optimizer/LESSONS.md has 4 active band-aids." Root cause identified: "premature optimization in manager.ts." |
| 16 | `brief-migrate-scout-archetype.md` | evidence-backed | Cites successful prior migrations (coder, coach). Small operational task. |
| 17 | `brief-p78-deployment-cancelled.md` | mixed | Cites "HB#1456" and references existing tested code. But "supply chain attack" risk is theoretical — no evidence of an actual attack or near-miss. The scan-skill logic exists but the urgency is assumed, not data-driven. |
| 18 | `brief-read-safety-guard.md` | mixed | Describes "context overflow" and "binary noise" problems but doesn't cite specific incidents or session IDs. The strategy ("Hard Constraint" over "Soft Prompt") is assumed to be better without a comparison. |
| 19 | `brief-unified-guards-cancelled.md` | theory-first | Proposes a full Guard middleware architecture (interface, types, two implementations, test suite) without any POC. Cites FM-3.3 and "path hallucination" but the solution jumps to a complex interface design. No experiment validating that middleware guards actually improve pass rates vs. simpler approaches. |
| 20 | `brief-verify-gym-scenario.md` | evidence-backed | Verifies an existing implementation rather than proposing new design. Good practice. |
| 21 | `brief-workflow-verify-finish.md` | mixed | Cites pivot from "Hard Constraints" to "Workflows" (Req 8b381f87). But the workflow design (5-step with retry loop) is speculative — no evidence that this approach works better than the guard it replaces. |
| 22 | `design-harness-guards-cancelled.md` | mixed | Cites specific scenario failures (`behavior-escalation-stubborn`, `conflicting-evidence`) with concrete root causes. But jumps to three new Guard implementations without testing any single one first. |
| 23 | `design-unified-guards.md` | theory-first | Full architecture design (Guard interface, VerificationGuard, EnvironmentGuard, refactor plan). Cites FM-3.3 and C26 as motivation but proposes a complex middleware system without any POC. This is the same pattern as #19 — design the interface before validating the approach. |
| 24 | `directive-structured-delegation.md` (2026-03-23) | mixed | Cites Coach's report of "vague delegation as a major failure mode." But proposes a new tool (`delegate`) without measuring current delegation failure rate or testing a simpler fix (e.g., prompt instruction). |
| 25 | `brief-tune-active-nudge.md` (2026-03-23) | evidence-backed | Cites "telemetry shows a high false-positive rate for Research/Review Agents." Proposes specific threshold adjustments with rationale per role. Data-driven tuning. |
| 26 | `brief-fix-gym-identity.md` | mixed | Long debugging narrative (1800+ words of live reasoning). Valuable diagnosis but reads more like a stream-of-consciousness investigation than evidence → action. The conclusion ("Always Sandbox Agents") is sound but arrived at through extensive guesswork in the doc itself. |
| 27 | `2026-03-24-design-structured-delegation.md` | mixed | Cites "Context Thrashing" and "Alignment Drift" as problems but provides no session IDs, error counts, or incident data. The schema proposal is detailed but the assumption ("structured send solves delegation failures") is untested. |
| 28 | `brief-agent-evolution.md` | theory-first | Massive design doc (2000+ words) proposing an entire "Agent Evolution System." Does cite the coder SOUL slim (7.8KB→2.4KB, 10/13 pass) as prior evidence — that's good. But 80% of the doc is questions and speculative architecture ("What should the measurement system look like?"). This is a research brief, not an evidence-backed design. |
| 29 | `brief-scout-prompt-pilot.md` | evidence-backed | Proposes a controlled experiment: Control vs Variant, specific scenarios to test, clear success criteria (pass rate, token usage). Good experimental design even if the hypothesis is somewhat assumed. |
| 30 | `review-prompt-simplification.md` | evidence-backed | Analytical review of another team's proposal. Cites specific risks (Lobotomy by Deletion, Universal Trap). Recommends "Do not delete text unless a Gym scenario exists to cover it." Evidence-gated approach. |
| 31 | `brief-infra-structured-send.md` | mixed | Same as #27 — cites "Coach reports widespread failure" but no specific counts or session IDs. Solution is reasonable but untested. |
| 32 | `brief-monitor-active-nudge.md` | mixed | Defines three detectors (Loop, Ghost, Stall). References FM-1.3, FM-3.1, FM-2.6 but no incident frequency data. The thresholds (3 consecutive, 15 ops, 0 writes) are proposed without baseline measurement of current patterns. |
| 33 | `review-gym-snapshots.md` | evidence-backed | Review of another proposal. Identifies the "Effective Prompt Gap" — a real architectural flaw in config hashing. Constructive, evidence-aware critique. |
| 34 | `brief-tune-active-nudge-v2.md` | evidence-backed | Cites "Current data shows false positives for these agents (e.g., Tech-Lead flagged after 20 reads)." Specific role-based threshold table. Data-driven refinement. |
| 35 | `design-review-prompt-simplification.md` | evidence-backed | Architectural review. Cites "52KB" prompt bloat as data point. Identifies "Gym coverage <30%" as a risk. Recommends evidence-gating: "Pause Phase 2 until Methodology sections are protected." |
| 36 | `2026-03-24-brief-infra-verification-evidence.md` | evidence-backed | Cites specific agent failures: "Coder: Updated .gitignore without reading it", "Coach: Tests passed without running tests", "Optimizer: Deployed while edits failed." Concrete examples. |
| 37 | `review-gym-tracking.md` | evidence-backed | Review with specific architectural critique (dynamic context gap in config hash). Endorses DB unification with implementation guidance. |
| 38 | `brief-infra-finish-verification.md` | evidence-backed | Cites specific incidents ("Coder: Updated .gitignore didn't read it", "Coach: Ready to test didn't run test"). Proposes detective control, not speculative architecture. |
| 39 | `2026-03-24-plan-gym-integration.md` | theory-first | Massive integration plan (2500+ words). Grand "Cognitive CI" vision with taxonomy tables, role definitions, and 3-phase roadmap. Cites existing components but the overall system design is speculative — no evidence that this specific coordination model (Optimizer as Gatekeeper, Coach as Test Engineer) will work. Designed before validated. |
| 40 | `2026-03-24-brief-behavioral-verification-evidence.md` | evidence-backed | Concise. Cites FM-3.3 pattern. Proposes training scenario + rule update. Appropriate scope. |
| 41 | `directive-philosophy-update.md` | mixed | Cites DD#390 (BIGMAS) and DD#391 (Distributed Systems Limits) as evidence. But the principles being added ("Amdahl Limit", "Capability-Architecture Orthogonality") are theoretical claims from research, not validated in our system. |
| 42 | `brief-infra-gym-identity.md` | evidence-backed | Cites "Total Failure" in judge-bias tests for non-coder agents. Diagnoses root cause precisely. Revised plan mid-doc when first approach had a flaw. |
| 43 | `review-agent-teams.md` | evidence-backed | Thorough architectural review. Identifies 3 specific risks (Universal Inheritance loss, Migration Cliff, Headless Product Team). Proposes incremental approach (config-driven before directory restructure). |
| 44 | `brief-agent-evolution-rollout.md` | mixed | References the evolution architecture doc. Defines roles and protocols. But the "New Protocols" for Coach and Optimizer are untested — no evidence that "Gym is Law" enforcement improves outcomes vs current approach. |
| 45 | `brief-graph-designer.md` | theory-first | Cites DD#390 ("+36% gains") and DD#391. But the "Dynamic Graph Designer" is a speculative capability. No POC, no evidence from our system that graph-based coordination is needed (only research papers). Proposes a full skill implementation based on theoretical gains. |
| 46 | `2026-03-24-brief-scout-prompt-simplification.md` | mixed | Cites behavioral drift and token waste. But no specific measurements of current token usage or drift incidents. The migration plan is reasonable but the urgency is assumed. |
| 47 | `brief-monitor-active-nudge.md.v2` | mixed | Refines v1 thresholds. References "research agents" needing higher thresholds (from v1 feedback). But new thresholds (15 min, 30 ops) are still proposed without measurement data. |

---

## 2. Summary Statistics

| Score | Count | % |
|-------|-------|---|
| **evidence-backed** | 25 | 53% |
| **mixed** | 18 | 38% |
| **theory-first** | 4 | 9% |

### Breakdown by document type:
- **Reviews** (4): 4/4 evidence-backed (100%) — Bob is excellent at reviewing others' work with an evidence lens
- **Deployment briefs** (8): 7/8 evidence-backed (88%) — Rolling out existing work is naturally evidence-backed
- **Experiment briefs** (5): 5/5 evidence-backed (100%) — Auto-evolve experiments are well-designed
- **Architecture/Design briefs** (10): 2/10 evidence-backed, 4/10 theory-first or heavy theory-first lean (40% problematic)
- **Infrastructure briefs** (12): 7/12 evidence-backed (58%)
- **Directives/Rollouts** (8): 4/8 mixed or theory-first (50% problematic)

---

## 3. Assessment

### Is this a real pattern worth fixing?

**Yes, but it's narrower than expected.**

Bob is NOT "theory-first" as a general habit. **53% of briefs are solidly evidence-backed**, and his reviews are consistently excellent. The problem is **specific to architecture and design briefs** — when Bob is in "Architect mode" (designing systems, interfaces, frameworks), he tends to:

1. **Design before validate**: The Unified Guard Architecture (`design-unified-guards.md`, `brief-unified-guards-cancelled.md`) is the clearest example — a full middleware pattern with interfaces, implementations, and test plans, without first testing whether a single guard actually improves gym pass rates.

2. **Scale before prove**: The Gym Integration Plan (`2026-03-24-plan-gym-integration.md`) is a 2500-word vision document with roles, taxonomy, and phases — before proving the basic loop works.

3. **Cite research as evidence for implementation**: The Graph Designer brief cites "+36% gains" from a research paper, but that's not evidence from our system.

**The 4 pure theory-first briefs** are all in the "design a new system" category:
- Unified Guard Architecture (×2 versions)
- Gym Integration Plan
- Graph Designer

**The 18 mixed briefs** typically have good problem identification (with evidence) but then propose solutions that outscale the evidence — e.g., proposing a full structured delegation tool because "Coach reports delegation failures" (no counts, no incident data).

### What's working well:
- **Experiment design**: Auto-evolve briefs are methodologically sound (baseline, variations, measurement)
- **Reviews**: Consistently evidence-gated ("Don't delete unless gym covers it")
- **Deployment briefs**: Operational, scoped, concrete
- **Self-correction**: Several briefs were later cancelled (e.g., `design-harness-guards-cancelled.md`), suggesting the team catches over-engineering

### Recommendation:
A lightweight gate would help for **design/architecture briefs specifically** — something like "Before proposing a new system, cite: (1) the specific incidents motivating it, (2) a simpler alternative you considered and why it's insufficient, (3) a POC or experiment to validate the core assumption." This gate is NOT needed for deployment briefs, reviews, or experiments — those are already evidence-disciplined.
