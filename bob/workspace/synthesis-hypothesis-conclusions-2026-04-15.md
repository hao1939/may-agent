# Hypothesis Conclusion Synthesis — 2026-04-15

## Summary

Six hypotheses received formal conclusions today across two parallel threads:

| Hypothesis | Verdict | P(H) | Thread |
|---|---|---|---|
| **H-098** Attention Channel Theory | CONCLUDED — Confirmed with refinements | 0.80 | 1 |
| **H-099** Discovery Task Boundary | CONCLUDED — Confirmed | 0.90 | 1 |
| **H-091** Skill Delivery Methods | CONCLUDED — Confirmed | 0.93 | 1 |
| **H-085** Forced Externalization General Mechanism | CONCLUDED — Confirmed with boundaries | 0.85 | 2 |
| **H-095** Agent-Specific Failure Interventions | Partially Confirmed — Production Validated | 0.88 | 2 |
| **H-093** Complexity-Induced Verification Collapse | Partially Confirmed — Production Validated | 0.72 | 2 |

**All 6 succeeded.** No failures or issues in either thread.

---

## Thread 1: H-098, H-099, H-091

### H-098 — Attention Channel Theory
**Verdict**: CONFIRMED with refinements. The three-channel model (Ch1 text, Ch2 environmental, Ch3 positional) is the most explanatory framework for intervention effectiveness. 13/15 predictions supported across 4 direct tests (EXP-127/128/129/131). One prediction rejected (P-098c: Ch2 budget is larger than predicted — hump curve at 3 gates, not cliff at 2). Ch3 has a task-type boundary: works for behavioral tasks (100%) but fails for analytical judgment under coding momentum (0%).

### H-099 — Discovery Task Boundary
**Verdict**: CONFIRMED. All three intervention channels exhausted on discovery tasks across 7 experiments (N=84). Ch1 actively harmful (8% vs 67% baseline, p=0.005). Ch2/structural null (56% vs 61%). Ch3 actively harmful (33% vs 100%, p=0.030). External validation from 6 Einstellung effect papers. Template-following displaces exploration — creative inference is irreducible to scaffolding.

### H-091 — Skill Delivery Methods
**Verdict**: CONFIRMED. 12 experiments establish the mechanism hierarchy: text rules (0%) < echo-back (+1.3) < checklist (+2.0) < few-shot (+2.3) < workflow (100%). Matched few-shot achieves 18/18 (100%) across domain-matched scenarios for both judgment and process discipline. Three boundaries mapped: (1) temporal discipline untouched by few-shot, (2) domain proximity required for hard scenarios, (3) delivery position is dominant — system-prompt = 0%, task-message = 100%.

---

## Thread 2: H-085, H-095, H-093

### H-085 — Forced Externalization General Mechanism
**Verdict**: CONFIRMED with well-mapped boundaries. The single general mechanism behind all successful judgment interventions. 18 experiments, 17 scenarios, 5 failure domains, 56/73 runs passing. Six boundary conditions: (1) debugging/implementation tasks, (2) absent-information tasks, (3) multi-document transfer gap, (4) execution crowding, (5) discovery tasks (resolved via H-099), (6) recognition sub-boundary on absent-field detection.

### H-095 — Agent-Specific Failure Interventions
**Verdict**: PARTIALLY CONFIRMED — Production Validated. Three deployed guards demonstrate massive agent-specific improvements (+51pp to +100pp). Strongest evidence: same checklist achieves +100pp for optimizer (EXP-115) but −67pp for Bob (EXP-117). 4 of 7 agents still lack matched guards; 30-day stability predictions untested. Status: graduated from research to engineering.

### H-093 — Complexity-Induced Verification Collapse
**Verdict**: PARTIALLY CONFIRMED — Production Validated. FM-3.3 is #1 error type at 20.3% of 999 errors across 384 sessions. Terminal attractor — errors cascade into verification collapse but rarely out. Near-zero quality-opCount correlation (r=0.099) confirms complexity, not length, drives collapse. Agent gradient: Scout 6% → Optimizer 73%. Gym-production gap (4.8% vs 50-70%) is structural and unbridgeable (KE-107).

---

## Cross-Thread Connections

### 1. The Unified Intervention Architecture (H-098 → H-085 → H-091 → H-099)
These four hypotheses form a coherent theory of agent interventions:
- **H-098** provides the channel framework (Ch1/Ch2/Ch3)
- **H-085** explains WHY Ch2 works (forced externalization activates analysis)
- **H-091** explains HOW delivery matters (position > content quality)
- **H-099** defines WHERE nothing works (discovery tasks resist all channels)

This is arguably the most important intellectual contribution from the research program — a complete, empirically grounded theory of when and how to intervene in agent behavior.

### 2. Agent-Specificity as Cross-Cutting Theme (H-095 ↔ H-099 ↔ H-085)
H-095 shows the same intervention can be +100pp or −67pp depending on the agent. H-099 shows the same channel (Ch2) can be +100pp on execution tasks or null on discovery tasks. H-085's boundary conditions are effectively the map of where agent-specificity dominates. Together: **universal interventions are dangerous; targeting is mandatory**.

### 3. The Verification Gravity Well (H-093 ↔ H-085 ↔ H-095)
H-093 identifies verification collapse as a terminal attractor. H-085's forced externalization is the primary countermeasure. H-095's agent-specific guards (especially the verification-depth guard, EXP-123) are the production implementation. The pipeline: **CIVC theory → externalization mechanism → agent-specific deployment**.

### 4. No Contradictions Found
All six hypotheses are mutually consistent. The "Partially Confirmed" status of H-095 and H-093 reflects incomplete coverage (not all agents have guards; gym-production gap prevents lab testing), not contradictory evidence.

---

## Findings Ranked by Impact/Novelty

1. **Discovery task irreducibility (H-099)** — Most novel. No existing agent safety literature identifies this boundary. All three channels exhausted with N=84. Has direct implications for system design: don't try to scaffold creativity.

2. **Attention Channel Theory (H-098)** — Highest explanatory power. Unifies 15+ experiments into a single predictive framework. The Ch2 > Ch1 finding alone saves enormous engineering effort.

3. **Forced externalization mechanism map (H-085)** — Most experimentally validated single finding in the project (18 experiments, 73 runs). The six boundary conditions are actionable engineering specs.

4. **Agent-specificity as production principle (H-095)** — Most immediately actionable. The ±100pp differential on same intervention is the strongest argument for personalized agent infrastructure.

5. **CIVC as terminal attractor (H-093)** — Most important for production reliability. The "gravity well" finding means verification collapse must be prevented, not recovered from.

6. **Few-shot delivery position effect (H-091)** — Most surprising. System-prompt = 0% vs task-message = 100% for identical content. Explains years of "knowledge files don't work" observations.

---

## PRIORITY-TRACKER Update Assessment

The PRIORITY-TRACKER at `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md` **needs updating** in two areas:

### A. Status Lines (Lines 18-31)
The tracker still shows working-theory descriptions with P(H) values but NOT the formal "CONCLUDED" or "Partially Confirmed" status. Six entries need status prefix updates:
- **H-085** (line 18): Add "CONCLUDED" prefix
- **H-091** (line 21): Add "CONCLUDED" prefix  
- **H-093** (line 26): Add "Partially Confirmed — CONCLUDED" prefix
- **H-095** (line 29): Add "Partially Confirmed — Production Validated" prefix
- **H-098** (line 30): Add "CONCLUDED" prefix
- **H-099** (line 31): Already shows "CONFIRMED" — update to "CONCLUDED"

### B. Confidence Summary (Line 225)
The "22 high confidence" count and list should reflect that 4 of these are now CONCLUDED (H-085, H-091, H-098, H-099) and 2 are Partially Confirmed with formal conclusions (H-093, H-095). Consider splitting into "concluded" vs "active high-confidence" categories.

### Recommendation
Update PRIORITY-TRACKER in a dedicated session — it's a large, complex file and edits require careful line-by-line verification. The hypothesis files themselves already have correct status lines.

---

## Proposed Next Steps

1. **Deploy remaining H-095 guards** — Coach FM-2.1 approach guard (highest leverage per KE-115), Coder FM-1.1 task check, cross-agent FM-2.4 scope enforcement
2. **Build harder gym scenarios for CIVC** (H-093) — bridge the gym-production gap for interventional testing
3. **Monitor execution crowding** (H-085 boundary 4) — as more guards accumulate per H-095, watch for Ch2 budget exhaustion
4. **Test H-105 Three-Layer Reasoning** — extends H-099/H-098 channel theory, EXP-146 designed but blocked
5. **Update PRIORITY-TRACKER** — reflect concluded statuses

---

*Synthesized 2026-04-15 by Bob (Architect). Source: Thread 1 (H-098/H-099/H-091) and Thread 2 (H-085/H-095/H-093).*
