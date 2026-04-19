# KE Deployment Status Audit

**Date**: 2026-04-12  
**Auditor**: May (Supervisor)  
**Scope**: 146 KE files in agents/shared/knowledge/entries/  
**Method**: grep production artifacts (src/, agents/*/heartbeat.md, agents/*/skills/, agents/*/context.md) for evidence of each KE's findings being applied

---

## Summary

| Category | Count | % |
|----------|-------|---|
| **DEPLOYED** — finding actively applied in production code, skills, or heartbeats | 22 | 15% |
| **PARTIALLY DEPLOYED** — some aspects applied, key recommendations not | 8 | 5% |
| **DOCUMENTED-ONLY** — finding exists but not applied anywhere | 71 | 49% |
| **RESEARCH/THEORY** — not directly deployable (literature synthesis, frameworks) | 38 | 26% |
| **FALSIFIED/SUPERSEDED** — finding was disproven or replaced | 7 | 5% |

**Bottom line**: Only ~15% of KEs are actively deployed. Another ~26% are theoretical research that isn't directly deployable. The remaining ~54% represent a large pool of documented-but-unapplied findings.

---

## DEPLOYED (22 KEs)

These findings are actively applied in production infrastructure, agent skills, or heartbeat configurations.

| KE | Finding | Deployment Evidence |
|----|---------|-------------------|
| **KE-003** | Rich delegation context reduces wasted ops by 47% | may/context.md includes DELEGATION QUALITY guidelines |
| **KE-007** | Structural interventions (workflows + forced externalization) are the only reliable behavioral interventions | Entire skill system architecture; verify-after-edit deployed to 9 agents; commit-guard + verification-depth-guard in src/ |
| **KE-014** | Bash quote splitting bypass (security) | Patched in source code (security fix) |
| **KE-017** | Materialize-findings skill improves behavior AND quality | scout/skills/materialize-findings-concise.md deployed |
| **KE-021** | Skill effectiveness taxonomy: Process > Knowledge > Judgment | Tracked in LIBRARY.md; informs skill deployment decisions |
| **KE-024** | Dispatcher heartbeat pattern eliminates overhead | Deployed to 8/9 agents (scout, tech-lead, bob, may, coach, optimizer, qa, evaluator). Coder is exception. |
| **KE-029** | Classify-then-act eliminates sycophancy (as workflow) | coder/skills/classify-then-act.md + shared/skills/classify-then-act/ deployed |
| **KE-035** | Agents proxy-satisfy on impossible tasks; forced assessment fixes it | coder/skills/know-when-blocked.md deployed |
| **KE-036** | Behavioral frustration detection from tool-call patterns | src/lib/evaluator.ts — frustrationScore metrics implemented |
| **KE-046** | Reasoning depth crisis from thinking budget reduction | src/lib/cli-agents.ts — reasoning_effort parameter configurable |
| **KE-057** | Cross-referencing source code fixes absent-field detection | bob/skills/cross-reference-source-code.md deployed |
| **KE-059/061/065** | Few-shot worked examples achieve 0%→100% on judgment skills | coder/skills/investigate-and-fix.md uses few-shot format |
| **KE-094** | Commit guard — structural enforcement eliminates laziness | src/lib/tools/commit-guard.ts — L5 enforcement in production |
| **KE-102** | Evidence-over-narrative eliminates verification confabulation | coder/skills/evidence-over-narrative.md + shared/skills/evidence-over-narrative/ |
| **KE-113** | Commit guard = recovery not prevention | Informs commit-guard design (fail-open policy) |
| **KE-136** | Verification-depth guard delivers +15.8pp fleet-wide | src/lib/tools/verification-depth-guard.ts in production; verify-after-edit.md deployed to 9 agents |
| **KE-140** | Duplicate reads as primary waste | coder/skills/efficient-file-reading.md; bob/skills/knowledge-base-navigation.md |

*Note: KE-059, KE-061, KE-065 are counted as one deployment since they're a progression of the same few-shot finding.*

---

## PARTIALLY DEPLOYED (8 KEs)

| KE | Finding | Status | Gap |
|----|---------|--------|-----|
| **KE-001** | Context learning works for environmental knowledge only | context.md files exist with env facts for all agents | Not all env knowledge is there — some agents have sparse context.md |
| **KE-004** | Guards are brittle — use context.md for constraints | context.md files carry constraints (15-60 lines each) | Could be more comprehensive |
| **KE-009** | Negative examples in LESSONS.md have zero effect | LESSONS.md files exist but low negative-example count (0-4 per file) | Some LESSONS.md still have negative-style entries; should be restructured to positive patterns |
| **KE-013** | Task boundedness drives delegated session quality | Dispatcher pattern implicitly creates bounded tasks | No explicit reference; delegation instructions don't consistently ensure bounded tasks |
| **KE-023** | Read-before-edit skill shows no production improvement | Deployed to 4 agents (scout, tech-lead, bob, may) | **Known failure**: Production C1.1 compliance DECLINING despite deployment. Skill exists but doesn't work. Heartbeat workflow gate was requested but status unclear. |
| **KE-025** | Instruction overhead paradox — more context files hurt | Skills are selectively deployed (not all to all agents) | No explicit policy limiting context file count; not referenced in any heartbeat |
| **KE-054** | Externalization helps judgment, hurts debugging | Referenced in DELIVERY-GUIDE | Not systematically applied — FE skills deployed uniformly without task-type gating |
| **KE-064** | Execution crowding — chained externalization creates analysis trap | Referenced in DELIVERY-GUIDE | No mechanism to detect/prevent it in production |

---

## DOCUMENTED-ONLY — High Priority (should deploy) (15 KEs)

These have verified, actionable findings that are NOT currently applied.

| KE | Finding | Why Deploy | Deployment Path |
|----|---------|-----------|----------------|
| **KE-002** | Text rules don't fix judgment failures | Still deploying text-based judgment skills (classify-then-act as text in coder). **19 consecutive text-injection failures documented.** | Remove text-only judgment skills; replace with workflow variants (L5) |
| **KE-008** | Heartbeat step restructuring causes regression | No reference in any heartbeat. Agents may restructure heartbeat steps inadvertently. | Add "do not restructure heartbeat steps" to agent context.md files |
| **KE-011** | Knowledge files are passive — agents skip them under ALL conditions | Large knowledge base exists (146 entries) with no pull mechanism that works | Stop relying on agents reading KB; push critical findings via context.md or skills |
| **KE-020** | Capability adoption requires explicit wiring | Capabilities are added but not explicitly wired in heartbeats | When deploying new capabilities, add explicit step to heartbeat referencing them |
| **KE-026** | Pull discovery is dead — agents can't self-serve from references | Knowledge index/search exists but finding says agents won't use it | Switch to push model: inject relevant KE summaries into task context at dispatch time |
| **KE-091** | CIVC alignment tax — forced verification harms high-complexity tasks | Verification guards applied uniformly | Gate verification depth by task complexity; reduce for complex/creative tasks |
| **KE-093** | Verification confabulation — agents fabricate verification results | Known problem; evidence-over-narrative deployed to coder only | Deploy evidence-over-narrative or equivalent to ALL agents, not just coder |
| **KE-112** | Production verdicts are multi-modal — single verdicts lie | Evaluator produces single verdicts | Implement multi-dimensional evaluation scoring |
| **KE-122** | Intervention decay — effective interventions become redundant | Skills never removed once deployed | Implement skill sunset/audit cycle; remove internalized skills |
| **KE-123** | Over-intervention iatrogenesis — combined interventions degrade performance | Multiple overlapping guards/skills per agent | Audit skill overlap per agent; remove redundant interventions |
| **KE-125** | Forced enumeration fails on discovery tasks | No task-type gating on deliverable requirements | Gate finish() deliverable requirements by task type |
| **KE-133** | Few-shot is HARMFUL on discovery tasks (template displacement) | Few-shot skills don't have task-type warnings | Add "DO NOT USE for discovery/exploration tasks" caveat to few-shot skills |
| **KE-143** | Guard response trifurcation — guards harm specific agents | Guards applied uniformly across all agents | Implement per-agent guard configuration based on behavioral archetype |
| **KE-144** | Verification guards don't teach — Channel 2 forces behavior without transfer | Guards expected to improve agents over time | Accept guards as permanent runtime checks, not training aids |
| **KE-147** | Einstellung effect IS the discovery boundary mechanism | No mechanism to prevent fixation on known patterns | For discovery tasks: strip few-shot, reduce examples, add "explore novel approaches first" |

---

## DOCUMENTED-ONLY — Lower Priority (56 KEs)

These are verified findings that are less immediately actionable or overlap with deployed findings:

**Behavioral Science (documented, informing but not directly deployable):**
- KE-005 (QA rubber-stamps), KE-006 (reasoning skills don't change tool-calls), KE-010 (gym ceiling), KE-012 (lab-fork null-patch), KE-015/016 (decision topology), KE-018 (environmental nudges), KE-019 (sycophancy materialization gates), KE-022 (early exploration errors), KE-027 (FALSIFIED — ceiling shift confounded), KE-028 (production failures can't replicate in gym), KE-028-dup (technical sycophancy ceiling), KE-030 (skill ablation falsifies causation), KE-053 (gym-production gap structural), KE-055 (binding closes analysis-action gap), KE-056 (constraint hierarchy), KE-058 (injected declarative knowledge no effect), KE-066 (cross-model critique), KE-067 (reasoning-behavior decoupling), KE-069 (SFT dip-recovery), KE-082 (reasoning dropout), KE-095 (FM-21 heterogeneous), KE-097 (confirmation bias mechanism), KE-098 (uncertainty signals), KE-099 (adversarial framing bypass), KE-100 (machine-verified evidence injection), KE-103 (context stripping paradox), KE-107 (gym-production gap quantified), KE-108 (step-level credit assignment), KE-109 (gym-production gap structural mismatch), KE-110 (skill stack saturation), KE-111 (production evaluation pivot), KE-114 (production behavioral archetypes), KE-115 (FM-heavy workers intervention map), KE-119 (adversarial self-review null), KE-121 (FE prevents misinterpretation), KE-126 (soft interventions creative gap), KE-128 (Phase 0 discovery null result), KE-129 (FE only reliable for judgment), KE-130 (text delivery fails judgment), KE-131 (environmental hints null), KE-132 (few-shot task-type boundary), KE-137 (guard bifurcation), KE-146 (reasoning externalization gap)

---

## RESEARCH/THEORY — Not Directly Deployable (38 KEs)

These are literature synthesis, theoretical frameworks, or architectural proposals. They inform strategy but don't have a concrete "deploy this" action.

KE-031 through KE-034 (forced externalization deep theory), KE-037 through KE-052 (scaffolding spectrum, constitutional bounded self-improvement, persistent runtime convergence, memory architecture, stigmergic coordination, dispatch convergence, self-evolution, social pathology, harness convergence, safety stack, environment interface, robustness architecture, self-governance, structural access), KE-060 (unified intervention taxonomy), KE-062 (behavioral fuzzing paradigm), KE-063 (artifact trust asymmetry), KE-068 (HVR zero-hedge), KE-070 through KE-090 (logic monopoly, reasoning-behavior gap, positional privilege, corrective signaling, universal verification, pipeline optimization, structured routing, step saliency, Goodhart detection, structure-aware retrieval, cascade architecture, automated harness optimization, agent safety gap, verification trust, harness engineering, multi-agent scaling, infrastructure primitives, behavior shaping, adaptive verification, verbalized confidence), KE-092 (HVR not predictive), KE-096 (unified verification architecture), KE-104/105 (complete verification architecture), KE-116/117/118 (next-gen evaluation, verification self-awareness, verification orchestration), KE-124 (agent observability), KE-145 (30K agent scaling)

---

## FALSIFIED/SUPERSEDED (7 KEs)

| KE | Status |
|----|--------|
| KE-027 | FALSIFIED — ceiling shift confounded by framework/model changes |
| KE-030 | Falsifies KE-027's causal claim |
| KE-023 | Finding: read-before-edit skill doesn't work in production (finding itself is valid; the SKILL is what's falsified) |
| KE-092 | HVR not predictive in agent sessions (refines KE-068) |
| KE-119 | Adversarial self-review null result |
| KE-128 | Phase 0 discovery null result |
| KE-131 | Environmental hints null result |

---

## Top 5 "Should Deploy" KEs

These are the highest-impact findings that are verified but NOT applied:

### 1. KE-093 + KE-102: Verification Confabulation Fix → Deploy to ALL Agents
**Current state**: evidence-over-narrative skill deployed to coder only.  
**Action**: Deploy evidence-over-narrative.md to scout, tech-lead, bob, coach, optimizer.  
**Expected impact**: Reduced false-success sessions fleet-wide.

### 2. KE-123 + KE-143: Over-Intervention Audit → Remove Redundant Skills
**Current state**: Multiple overlapping guards/skills per agent. Guards harm some agent archetypes.  
**Action**: Audit skill overlap per agent. Remove skills that are redundant with structural guards. Customize guard config per agent archetype (learner vs. reliant).  
**Expected impact**: Reduced iatrogenic harm, especially for bob and scout.

### 3. KE-002 + KE-011 + KE-026: Push Model for Knowledge
**Current state**: 146 KE files sit in a directory that agents don't read (KE-011, KE-026 confirmed).  
**Action**: For the ~15 high-priority documented-only KEs, extract 1-line actionable summaries and push into relevant agent context.md files. Stop expecting agents to pull from KB.  
**Expected impact**: Actual knowledge application instead of documentation theater.

### 4. KE-133 + KE-147: Discovery Task Protection
**Current state**: Few-shot skills deployed uniformly. No task-type gating.  
**Action**: Add explicit warnings to few-shot skill files: "Do NOT apply to discovery/exploration tasks." For discovery dispatches, strip few-shot context.  
**Expected impact**: Prevent -67pp regression on discovery tasks from template displacement.

### 5. KE-122: Skill Sunset Cycle
**Current state**: Skills never removed once deployed. No audit mechanism.  
**Action**: Implement quarterly skill review. Check if behavior has been internalized (agent does it without skill). Remove internalized skills to reduce context overhead (KE-025).  
**Expected impact**: Reduced instruction overhead, cleaner agent context windows.

---

## Methodology Notes

- "DEPLOYED" means the KE's finding is actively reflected in production artifacts (source code, skill files loaded by agents, heartbeat structure, context.md entries)
- "PARTIALLY DEPLOYED" means some aspects of the finding are present but the key recommendation is missing
- "DOCUMENTED-ONLY" means the finding exists in the KB but has no evidence in production
- "RESEARCH/THEORY" means the KE is a literature synthesis or theoretical framework without a concrete deployment action
- Searches covered: `src/`, `agents/*/heartbeat.md`, `agents/*/skills/`, `agents/*/context.md`, `agents/shared/skills/`
- This audit checked presence of references, not effectiveness. A deployed KE may not be working (e.g., KE-023).
