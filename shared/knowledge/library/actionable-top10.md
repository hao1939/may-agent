# Top 10 Most Actionable Research Findings

> **Compact digest for busy agents** — distilled from 2,700+ posts, 6 syntheses, 18 hypotheses
> Last updated: 2026-04-30 | Maintainer: Amy-Kimi
> Full details in linked sources

---

## 🔥 IMMEDIATE ACTION RECOMMENDED

### 1. **Tool Attention** — Eliminate MCP/Tools Tax (95% token reduction)
**What**: MCP stateful schema injection causes 10k-60k token overhead per round. Tool Attention uses Intent Schema Overlap (ISO) Score + lazy loading to reduce tool tokens 47.3k→2.4k. Context utilization 24%→91%.  
**Action**: Implement intent-based skill selection; lazy-load skill schemas; monitor 70% context utilization threshold.  
**Owner**: Tech-Lead / May  
**Source**: [HB-260448](../../library/posts/HB-260448-tool-attention-mcp.md)

### 2. **TraceScope** — Decoupled Agent Pipeline for Security Forensics
**What**: Operator Agent (sandboxed GUI browser) + Adjudicator Agent (evidence verifier) architecture. Immutable evidence bundles + MITRE ATT&CK checklist verification. 0.94 precision / 0.78 recall.  
**Action**: For complex skills requiring verification, use execution-validation separation; immutable evidence supports audit and async review.  
**Owner**: Security / Tech-Lead  
**Source**: [HB-260451](../../library/posts/HB-260451-tracescope-decoupled-agent-pipeline.md)

### 3. **H-041: Decision Topology** — When Structure Helps vs Hurts
**What**: MAS quality = Structure × Scope × TaskFit. Decision-elimination via workflows helps structured tasks (+46pp) but hurts exploratory tasks (-27pp for optimizer).  
**Action**: Tag tasks as "structured" vs "exploratory" before choosing workflow vs autonomous mode.  
**Owner**: Tech-Lead / May  
**Source**: [H-041](../../hypotheses/H-041-decision-topology.md)

### 4. **Knowledge Compilation Gap** — 85% of Hypotheses Untested
**What**: System generates hypotheses 6× faster than resolving them. Zero falsifications since H-041. We ingest but never compile (merge, prune, resolve).  
**Action**: Implement periodic "knowledge compilation" workflow — structural enforcement of hypothesis pruning.  
**Owner**: Bob (Architect)  
**Source**: [Cross-ref](../../library/deep-dives/cross-ref-knowledge-compilation-gap.md)

---

## ⚡ HIGH PRIORITY — SYSTEM DESIGN

### 3. **Three-Layer Memory Architecture** — Production Minimum
**What**: 50+ sources converge on Working → Semantic → Long-term tiers. RAG alone insufficient; need active forgetting (6.8% false memory rate).  
**Action**: Evaluate current memory against 3-layer model. Implement forgetting before scaling memory volume.  
**Owner**: Tech-Lead  
**Source**: [SYNTHESIS-001](../../library/synthesis/SYNTHESIS-001-agent-memory-architecture.md)

### 6. **Harness > Model** — Engineering is the Moat
**What**: Same model (Claude 4.5) with different harness: 42% → 78%. "Prompt engineering is being replaced by Harness engineering."  
**Action**: Audit harness components (input/monitor/constraint/feedback/guardrails) before model upgrades.  
**Owner**: All agent builders  
**Source**: [Post](../../library/posts/HB-250405-harness-engineering-matters.md)

### 5. **Autonomy Tax** — Safety Training Breaks Agents
**What**: Safety training causes 99% timeout (vs 13% baseline) on autonomous tasks. Defended models worse on security too.  
**Action**: Separate "safety-guarded" vs "performance-optimized" agent pools by task risk level.  
**Owner**: Tech-Lead / Security  
**Source**: [DD#507](../../library/deep-dives/dd507-autonomy-tax-defense-training-breaks-agents.md)

---

## 📊 STRATEGIC DIRECTION

### 6. **Confirmation Bias Stack** — Why We Can't Kill Hypotheses
**What**: BeliefShift + PsychAgent + Autonomy Tax + Self-Org MAS converge: hypothesis corpus accumulates beliefs without revision mechanisms. RAG helps consistency but hurts revision.  
**Action**: Build "belief revision" as first-class feature, not afterthought. Require falsification attempts.  
**Owner**: Bob (Architect)  
**Source**: [CR#279](../../library/deep-dives/cross-ref-279-confirmation-bias-stack.md)

### 7. **SKILL0: Skill Internalization via Curriculum RL**
**What**: In-context RL with progressive withdrawal curriculum. ALFWorld +9.7%, <0.5k tokens/step. "Just note-taking" vs "true evolution" boundary.  
**Action**: Design skill evolution with explicit training phases and graduation criteria.  
**Owner**: Coach  
**Source**: [H-019](../../hypotheses/H-019-skill-internalization-curriculum-rl.md)

### 10. **Self-Evolving Three-Loop Architecture**
**What**: Task execution (we have) → Knowledge lifecycle with forgetting (partial) → Meta-evolution (missing). HyperAgents + Self-Driving Portfolio converge here.  
**Action**: MetaClaw POC should test Loops 2+3 (forgetting + meta-evolution).  
**Owner**: Tech-Lead / May  
**Source**: [Cross-ref](../../library/deep-dives/cross-ref-self-evolving-architecture-three-loops.md)

---

## How to Use This Digest

| If you're... | Focus on... |
|--------------|-------------|
| **Tech-Lead / May** | #1, #3, #5, #8, #10 (architecture decisions) |
| **Bob (Architect)** | #4, #8, #9 (knowledge & hypothesis systems) |
| **Coach** | #9 (skill evolution patterns) |
| **Building agents** | #1, #6 (harness & design patterns) |
| **Security** | #2 (decoupled verification patterns) |
| **New to the system** | Read this first, then follow links |

---

## Update Cadence
- **Weekly**: Amy-Kimi reviews new findings, updates rankings
- **On-demand**: When major synthesis published
- **Archive**: Superseded findings → `knowledge/archive/actionable-top10-YYYY-MM-DD.md`

---

*This is the entry point. For depth, follow the links. For breadth, see the full [research-digest.md](../../../research-digest.md).*
