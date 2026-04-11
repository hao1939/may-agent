# DD-749: Meta FAIR 30K-Agent Textbook Formalization

> ⚠️ **DUPLICATE**: This covers the same paper as **DD-544** (canonical entry). DD-544 is indexed in INDEX.md and referenced by KE-086. DD-749 provides expanded analysis (8 roles vs 6, 5 engineering decisions, limitations, actionable insights) but DD-544 remains the canonical reference. Refer to DD-544 for cross-referencing.

**Paper**: Automatic Textbook Formalization  
**Authors**: Gloeckle, Rammal, Arnal, Munos, Cabannes, Synnaeve, Hayat (Meta FAIR / ENPC / KIAS)  
**Source**: arXiv:2604.03071 (Apr 3, 2026)  
**Rating**: ★★★★★ CRITICAL  
**Scout Session**: 2026-04-11  
**Canonical Entry**: DD-544  
**Connected**: CR-290 (MAS Scaling Paradox), KE-101 (5 Laws), DD-731 (Capability ≠ Cooperation), DD-733 (DACS), CR-301 (Harness Engineering)

---

## Why This Paper Matters

This is the **largest published multi-agent software engineering deployment with full architectural disclosure**. 30,000 Claude 4.5 Opus agents collaborating on a shared codebase via git, completing a graduate-level textbook formalization in one week. It provides the first empirical evidence at scale for patterns we've been theorizing about.

---

## Core Architecture

### The Problem
Formalize a 500-page graduate textbook on algebraic combinatorics ("A Walk Through Combinatorics" by Miklós Bóna) into Lean 4 proof assistant code. This means converting every theorem, lemma, and definition into machine-checkable formal proofs.

### Scale
- **30,000 agent invocations** over 1 week
- **Claude 4.5 Opus** as base model for all agents
- **130,000 lines** of Lean code produced
- **5,900 declarations** (definitions, lemmas, theorems)
- **340/340 target theorems** proved (100% completion)
- **~$100K total cost** (~$200/page)

### Agent Roles (8 types)
1. **Sketcher** — Plans formalization strategy for each chapter/section; creates stub definitions and theorem statements
2. **Prover** — Takes a theorem statement and attempts to produce a complete Lean proof
3. **Maintainer** — Refactors code, fixes broken proofs after dependency changes, keeps build green
4. **Math Reviewer** — Reviews PRs for mathematical correctness and alignment with textbook
5. **Engineering Reviewer** — Reviews PRs for code quality, style, naming conventions, build compatibility
6. **Triage Agent** — Routes issues to appropriate agents based on type (proof failure, build error, style violation)
7. **Scan Agent** — Monitors repository for issues (broken proofs, stale dependencies, missed theorems)
8. **Progress Agent** — Tracks completion metrics, identifies bottlenecks, reports status

### Coordination Infrastructure
**The key insight: no bespoke multi-agent framework.** They use standard software engineering:

- **Git trunk-based development** — single main branch, all agents commit via PRs
- **PR review process** — every PR gets math review + engineering review before merge
- **Merge queue** — serialized merging to prevent conflicts (bottleneck by design)
- **Filesystem-based issue tracker** — issues as files in the repo, not an external system
- **Lean compiler as verifier** — automated CI checks every PR compiles and proofs verify
- **No direct agent-to-agent communication** — all coordination through shared artifacts (code, issues, PRs)

---

## Key Engineering Decisions

### 1. Over-Provision and Filter (11% Per-Agent Success Rate)
Individual agent success rate is only ~11%. This is **by design**. They launch many agents in parallel on the same task and filter for the ones that succeed. The Lean compiler provides a perfect binary verifier: either the proof compiles or it doesn't.

**Why this works**: 
- Formal verification domains have hard oracles — you can cheaply verify without understanding
- Cost of launching an extra agent ($3-5) << cost of building smarter agents
- No coordination overhead for parallel attempts on the same theorem
- Statistical guarantee: with N agents at 11% success rate, P(at least one succeeds) = 1 - 0.89^N

### 2. Structural Isolation of Work Units
The textbook is decomposed into ~5,900 independent declarations. Most proofs depend on definitions and lemmas but can be worked on independently. This converts a massive coordination problem into thousands of embarrassingly parallel tasks.

### 3. Reviewer-as-Quality-Gate
Human review is replaced by specialized reviewer agents. The math reviewer checks logical correctness; the engineering reviewer checks code quality. This separation of concerns prevents the common failure mode where a single agent must simultaneously reason about math AND code quality.

### 4. Merge Queue as Coordination Bottleneck
The merge queue serializes all integration. This is the **only point of global coordination**. Everything else is local. This trades throughput for consistency — and at 30K agents, throughput isn't the bottleneck.

### 5. Compiler as Ground Truth
Lean's type-checker serves as the ultimate verifier. Every PR must pass `lean --check`. This eliminates the "verification of verifiers" problem (DD-724, CR-330) — the ground truth is mechanical, not judgmental.

---

## Connections to Our Research

### CR-290: MAS Scaling Paradox — RESOLVED
We identified the paradox that multi-agent systems don't scale because coordination costs grow superlinearly. Meta FAIR resolves this **for partitionable domains**: if the work can be decomposed into independent units with cheap verification, coordination costs stay linear (proportional to merge queue throughput, not agent count).

**Conditions for the resolution**:
1. Domain must be decomposable into independent work units
2. Cheap, reliable verification oracle must exist (Lean compiler)
3. Communication can be mediated through shared artifacts (git) rather than direct messaging
4. Per-agent quality doesn't need to be high if you can over-provision

### KE-101 Law 1: Coordination Cost Dominates
The 11% success rate means 89% of compute is "wasted" — but this is rational because coordination cost of making agents smarter or more reliable would exceed the cost of over-provisioning. Structure (over-provision + filter) dominates content (better prompts or reasoning).

### KE-101 Law 3: Attention is Zero-Sum
Solved by decomposing the 500-page textbook into 5,900 declarations, each small enough for a single agent's attention budget. No agent needs to hold the entire textbook in context. The sketcher creates the decomposition; individual provers only see the relevant subset.

### DD-731: Capability ≠ Cooperation
Meta FAIR demonstrates that cooperation is an infrastructure property, not an intelligence property. The agents don't "cooperate" — they follow git protocols. Cooperation emerges from structural constraints (PR review, merge queue), not from agent intention.

### CR-301: Harness Engineering
This is the strongest empirical validation of the harness engineering thesis: the scaffold (git, CI, review process, issue tracker) does the coordination work, not the agents. The agents are "just" Claude 4.5 Opus with different system prompts.

### KE-120: CCC Triad (Cooperation-Calibration-Context)
1. **Cooperation** structurally enforced via merge queue and PR review — not assumed
2. **Calibration** via Lean compiler — binary pass/fail, no calibration uncertainty
3. **Context** actively isolated — each agent sees only its relevant subset

### DD-733: DACS (Dynamic Attentional Context Scoping)
Meta FAIR's decomposition into independent declarations is a natural implementation of context scoping — each agent gets a focused context window with only the relevant definitions, lemmas, and theorem statement.

---

## Limitations and Open Questions

### 1. Domain Dependence
This approach works spectacularly for formal math because:
- Work units are naturally independent
- Verification is mechanical (type-checker)
- Quality is binary (proof compiles or not)
- No subjective judgment needed

**It would NOT work for**: creative writing, design decisions, architecture choices — domains where verification is subjective and work units are deeply interdependent.

### 2. Merge Queue Bottleneck
The serialized merge queue processed ~2,000 PRs/day. At higher scale, this becomes the rate-limiting step. The paper doesn't discuss sharding the merge queue or parallel integration strategies.

### 3. Cost Efficiency
~$100K for 500 pages is expensive but not prohibitive. The 11% success rate means ~$18K of the $100K produced useful output. Better prompting or fine-tuning could potentially improve per-agent success rate, reducing cost proportionally.

### 4. Human Oversight
Despite full automation, the paper mentions periodic human review of agent outputs and manual intervention for particularly difficult theorems. The extent of human involvement is not fully quantified.

### 5. Agent Architecture
All agents are Claude 4.5 Opus with different system prompts. There's no discussion of whether different model sizes for different roles (e.g., smaller models for triage/scan, larger for proving) would be more cost-effective.

---

## Actionable Insights for Our System

1. **Git-based coordination scales**: We already use git for our agent coordination. Meta FAIR validates this approach at 1000× our scale.
2. **Over-provision + filter beats optimization**: When verification is cheap, launch many attempts rather than trying to make each one perfect.
3. **Role separation via system prompt**: 8 roles, all the same base model, differentiated only by system prompt. We do the same (Scout, Bob, Coach, Optimizer, etc.).
4. **Compiler-as-verifier pattern**: Where possible, use mechanical verification (tests, linters, type-checkers) rather than LLM-based review.
5. **Issue tracker as coordination primitive**: Filesystem-based issue tracking (files in the repo) is simpler and more robust than external systems or direct agent-to-agent messaging.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total agents deployed | 30,000 |
| Model | Claude 4.5 Opus |
| Duration | ~1 week |
| Lines of Lean code | 130,000 |
| Declarations | 5,900 |
| Theorems proved | 340/340 (100%) |
| Per-agent success rate | ~11% |
| Total cost | ~$100,000 |
| Cost per page | ~$200 |
| PRs processed per day | ~2,000 |
| Agent roles | 8 |

---

## Rating Justification: ★★★★★ CRITICAL

This paper is exceptional because:
1. **Scale**: 30K agents is 10-100× larger than any published multi-agent deployment
2. **Completeness**: Full architectural disclosure with metrics
3. **Validation**: 340/340 theorems proved — complete success
4. **Relevance**: Directly validates our coordination approach (git, roles, structural isolation)
5. **Novelty**: First proof that standard software engineering scales to thousands of AI agents
6. **Actionability**: Concrete patterns we can adopt (over-provision + filter, compiler-as-verifier)
