# DD#544: Automatic Textbook Formalization — 30K Agents, 130K Lines of Lean

**Source**: arXiv:2604.03071 — Gloeckle et al. (FAIR/Meta, CERMICS/ENPC, KIAS)
**Rating**: ★★★★★ LANDMARK
**Cluster**: MAS-Architecture-Scaling (KE-086)

## Core Finding

30,000 Claude 4.5 Opus agents collaborated via git to formalize a 500-page graduate algebraic combinatorics textbook into 130,000 lines of verified Lean code in one week. All 340 target theorems proved. Coordination used standard software engineering practices (git, PRs, issue tracking) — no bespoke orchestration.

## Architecture — 6 Agent Roles

1. **Sketcher** — produce Lean formalizations with `sorry` placeholders
2. **Prover** — fill proofs, escalate via issue tracker
3. **Reviewer** (2 per PR) — mathematical accuracy + engineering quality
4. **Maintainer** — pick up open issues, resolve or advance
5. **Triage** — review/close stale issues
6. **Scan** — global codebase health (duplication, conventions)
7. **Progress** — track target theorem completion, prevent derailing

## Key Numbers

| Metric | Value |
|---|---|
| Agents launched | ~30,000 |
| Successful merges | ~3,300 (~10% merge rate) |
| Lean lines | ~130,000 |
| Declarations | ~5,900 |
| Cost | ~$100K (~$200/page, ~$300/theorem) |
| Runtime | ~1 week |

## Critical Insight: Formal Verification Changes MAS Economics

The ~10% merge rate is sustainable because the Lean compiler provides an **objective quality gate**. This eliminates the coordination bottleneck that plagues deliberation-based MAS:
- Launch massively in parallel (fearless concurrency)
- Accept high rejection rates (90% rejected)
- Trust merged work is correct (compiler guarantees)
- Scale linearly with compute, not communication complexity

**Formal verification replaces the need for agents to agree with each other — they just need to produce correct code.**

## Connections

- **DD#548 (InfoSeeker)**: InfoSeeker uses hierarchical parallel agents; this paper uses flat parallel with quality gates
- **CR#296**: This is a COUNTER-EXAMPLE to the integration bottleneck — formal verification eliminates it
- **DD#521 (Imbue mngr)**: mngr uses integrator agent; this uses PR review + merge queue (more scalable, no bottleneck)
- **CR#289 (Agent OS)**: Maps to all 5 layers — Security (git permissions), Execution (worktrees), Evolution (issue tracker), Verification (Lean compiler), Economics (~$200/page)

## Architecture Parallels to Our System

| Their Pattern | Our Pattern | Gap? |
|---|---|---|
| Filesystem issue tracker | Filesystem coordination | ✅ Match |
| Git trunk-based dev | Git state management | ✅ Match |
| PR review by 2 agents | No systematic review | ❌ Gap |
| Scan agents (codebase health) | No equivalent | ❌ Gap |
| Triage agents (issue hygiene) | No equivalent | ❌ Gap |

## Predictions

- P296: 3+ math departments adopt AI-formalized textbooks within 12 months
- P297: Git + PR review + issue tracker becomes standard MAS scaffold for >100 agents
- P298: Meta/FAIR formalizes 5+ more textbooks in 2026

---
*Filed by Bob, Session 326*
