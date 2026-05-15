# Philosophy Updates — Review Summary for Hao
**Date**: 2026-03-15
**Prepared by**: May
**Status**: All ACKED by May, all BLOCKED on Hao approval

## Current State
- `agents/shared/philosophy.md`: **140 principles**, 1206 lines
- Highest principle in file: P202 (Agentic Search Governance)
- Also: P176, P177, P162, P147

## Pending Updates — Organized by Category

---

### CATEGORY A: Ready to Apply (Exact Edits Specified)

#### 1. P70 Revision + P163 New (Safety)
**Source**: `agents/bob/workspace/brief-philosophy-p70-p163.md`  
**What**:
- **P70 Frozen Anchors** — Expand to include `agent.json` as immutable, add "Persistence Poisoning" language
- **P163 Safety Isolation** — New. "Safety configuration must be structurally isolated from runtime capabilities."
**Exact edits**: Ready in `agents/may/workspace/todo.md` (from tech-lead)
**My recommendation**: ✅ **APPROVE** — P70 already enforced in code (commit 1b9d08c). P163 is the logical corollary. Both grounded.

#### 2. P206 Coordination Contracts (RAEV Loop)
**Source**: `agents/bob/workspace/brief-raev-coordination.md`
**What**: "Every delegation is a state transition, not a message." Request→Ack→Execute→Verify.
**My recommendation**: ✅ **APPROVE** — Already implemented as the P82 handoff tool. This just codifies what we're doing.

---

### CATEGORY B: GUA Laws (P150-P157) — Big Batch

**Source**: `agents/bob/workspace/philosophy-update-2026-03-15-gua-reconciled.md`

8 new principles from Scout's Grand Unified Architecture synthesis. Empirically derived laws.

| # | Name | Core Rule |
|---|------|-----------|
| P150 | Iteration Tax | Fewer rounds = better. Each round degrades. |
| P151 | Intelligence Paradox | Sophistication backfires under scarcity (C/N < 0.5) |
| P152 | Structure Over Scale | Protocol design > model size |
| P153 | Observer's Paradox | LLM can't validate its own system prompt |
| P154 | Topology Determines Vulnerability | Star/mesh bad for >3 agents |
| P155 | Memory Is Attack Surface | 3-layer defense needed |
| P156 | Cheap Signals Win | Heuristics beat deep reasoning for quick checks |
| P157 | Degradation Vortex | Any unchecked mechanism activates all others |

**My recommendation**: ⚠️ **NEEDS DISCUSSION** — These overlap significantly with existing principles:
- P150 ≈ P68 (Iteration Cap)
- P151 ≈ P115 (Complexity Rationing) — already noted as related
- P152 ≈ P127 (Structure Over Scale) — literally the same name
- P153 ≈ P128 (No Self-Grading)
- P155 ≈ P132 (Supply Chain Firewall) + P95 (Data Quarantine)
- P156 ≈ P140 (Passive Context First)

**Options**: (a) Add all 8 as-is, (b) Merge overlaps into existing principles, (c) Add as a "GUA Laws" appendix section

---

### CATEGORY C: Research-Backed New Principles

| # | Name | Source | Actionable? |
|---|------|--------|-------------|
| P158 | Clean Slate Rule | Error propagation 1.9x-6.1x compound | Yes — aligns with P86 Refresh or Fork |
| P166 | Protocol Convergence | GNAP validates file-based approach | Observational |
| P181 | Evaluation Granularity | Simpson's Paradox in eval | Yes — eval improvements |
| P182 | Hybrid Topology | Match loop to load (Easy→Tool, Hard→MAS) | Yes — routing optimization |
| P200 | Tool-Call Refinement | Gecko: validate before execute | Yes — harness improvement |
| P201 | Navigation Paradox | CodeCompass: nav > reading | Needs tooling (tree-sitter) |
| P203 | Topology is Policy | Break overthinking loops externally | Yes — harness improvement |

**My recommendation**: ✅ **APPROVE selectively** — P158, P200, P203 are most actionable. P166 and P182 are more observational. P201 requires tooling we don't have.

---

### CATEGORY D: Revisions to Existing Principles

| Existing | Proposed Change | Source |
|----------|----------------|--------|
| P11 | Add "Stable Prefix" (KV-cache optimization) | Bob |
| P13 | Add "Navigation Paradox" reference | Bob |
| P53 | Add "Recursive Evolution (SkillRL)" distinction | Bob |
| P80 | Add "Environment Diversity" (gym pattern) | Bob |
| P115 | Link to P151 (Intelligence Paradox) | GUA reconciliation |

**My recommendation**: ✅ **APPROVE P11 update** (KV-cache is concrete and measurable). Others are enrichments.

---

### CATEGORY E: Additional Proposals (from various batches)

- **P194, P195, P190** — from `agents/bob/workspace/philosophy-update-2026-03-15.md` (second batch). Need to locate exact text.
- **P200-P203** — from same file (P200 Tool-Call Refinement, P201 Navigation, P202 already applied, P203 Topology)
- **P35/P81 number conflict** — Bob proposed "Cross-Layer Fragility" and "Full-Stack Provenance" using P35/P81, but those numbers are already taken. Need new numbers.
- **Scout CR#95**: GUS Law 22, Principle 84, Prediction 84 (Measurement Problem)
- **Scout CR#97**: GUS extensions (Law 37, Mech 46, P101) for Failure Cascade Topology

---

## Overlap/Duplication Concern

Philosophy.md has grown from ~50 principles to 140 over a few weeks. Many proposed additions overlap with existing ones. The file risks becoming a "principle graveyard" where important rules get lost in volume.

**Suggestion**: Before adding the next batch, consider:
1. **Consolidation pass** — Merge overlapping principles (e.g., P95+P155, P68+P150, P127+P152)
2. **Tier system** — Mark principles as "Core" (always in context) vs "Reference" (in appendix)
3. **Max size** — Cap at ~150-160 principles in the main file; overflow to a reference doc

---

## Summary Recommendation

**Minimum viable batch** (5 changes, high value, low risk):
1. P70 revision (add agent.json + Persistence Poisoning)
2. P163 new (Safety Isolation)  
3. P206 new (Coordination Contracts / RAEV)
4. P158 new (Clean Slate Rule)
5. P200 new (Tool-Call Refinement)

**Extended batch** (add 4 more):
6. P203 new (Topology is Policy)
7. P181 new (Evaluation Granularity)
8. P182 new (Hybrid Topology)
9. P11 revision (Stable Prefix)

**Deferred** (need discussion on overlaps):
- P150-P157 (GUA Laws) — significant overlap with existing principles
- P166, P201 — observational / requires new tooling
- All Scout GUS extensions — need GUS file, not philosophy.md

**Total pending proposals**: ~23 new principles + ~5 revisions from ~40+ update files
**Philosophy.md would grow to**: ~160-170 principles if all approved
