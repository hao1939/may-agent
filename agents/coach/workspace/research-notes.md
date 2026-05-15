# Research Notes — 2026-04-30

Sources: scout deep-dives DD#866, DD#881, DD#867 (all from Apr 28-29, 2026)

---

## Actionable Coaching Methods Extracted

### 1. Epistemic State Tracking (from DD#866 — ADEMA)
**Method**: Add a lightweight "what I know / what's uncertain / what's committed" section to agent context.
**Why it works**: Tasks fail because knowledge states drift across rounds and intermediate commitments stay implicit. Explicit epistemic bookkeeping prevents this.
**Apply to**: Context fragmentation violations (H-EXP-055). Currently we track what agents *did* but not what they *know*.
**Critical finding**: Checkpoint/resume was the ONLY mechanism whose removal produced invalid runs. Validates our checkpoint infrastructure as #1 priority.

### 2. Stop Text-Based Coaching for Structural Problems (from DD#881 — CFV)
**Method**: For verification failures, stop investing in prompt-based skill interventions. Push for structural enforcement (pre-commit hooks, workflow gates, sidecar checks).
**Why it works**: Paper proves text-based filtering caps at F1=0.85 for context-fragmented violations. The remaining 15% requires architectural enforcement. This explains KE-338 (0% improvement from text coaching on verification failures over 502 attempts in 7 days).
**Apply to**: FM-3.3 premature success, C1.7 missing verification evidence, auditor handoff ignore rate (60%).

### 3. Semantic Taint Tokens for Handoffs (from DD#881 — CFV)
**Method**: Attach structured metadata (violation type, evidence, required action) to handoff messages. Workflow gates check tokens before allowing proceed.
**Why it works**: Agents ignore unstructured auditor feedback 60% of the time because the violation context doesn't integrate into their private context. Structured tokens force acknowledgment.
**Apply to**: Bob's H-206 (auditor handoff ignore rate), reviewer→coder feedback loops.

### 4. Iterative Loops > Single-Pass Delegation (from DD#867 — RecursiveMAS)
**Method**: Design coaching interventions around iterative refinement loops rather than single-shot instructions. The loop pattern itself is validated as architecturally superior.
**Why it works**: Single-pass delegation fails when full context can't be communicated upfront. Iteration allows progressive context building.
**Apply to**: Complex skill development where single coaching nudge is insufficient.

### 5. Reputation-Shaped Resource Allocation (from DD#866 — ADEMA)
**Method**: Explicitly allocate more coaching attention/compute to agents/paths with better track records. Formalize what coach does informally.
**Apply to**: Deciding which agents get intensive coaching vs. structural guardrails.

---

## Key Tension Identified
ADEMA recommends segment-level memory condensation, but OpenClaw found persona drift 90% caused by compaction. These are in tension — condensation helps long-horizon tasks but damages agent identity. Need selective condensation (compress facts, preserve identity markers).

## Bottom Line for Coach
**The #1 insight**: Text coaching has a ceiling (~85% effectiveness) for structural/verification problems. The path forward for our remaining failure modes is architectural (workflow gates, taint tokens, epistemic state sections) not more nudges.
