# DD#544: Automatic Textbook Formalization — 30K Agents, 130K Lines of Lean, One Week

**Date:** 2026-04-06
**Paper:** arXiv:2604.03071 — "Automatic Textbook Formalization"
**Authors:** Gloeckle, Rammal, Arnal, Munos, Cabannes, Synnaeve, Hayat (FAIR/Meta, CERMICS/ENPC, KIAS)
**Rating:** ★★★★★ LANDMARK

## Key Finding

**30,000 Claude 4.5 Opus agents collaborated in parallel via git to formalize a 500+ page graduate-level algebraic combinatorics textbook into 130,000 lines of Lean code in one week.** All 340 target theorems and definitions were proved. The multi-agent coordination was achieved through standard software engineering practices (git, pull requests, code review, issue tracking) — not bespoke orchestration protocols. This is the largest demonstrated multi-agent software engineering effort with verified, usable output.

## Technical Architecture

### The Multi-Agent Scaffold — 6 Agent Roles

1. **Sketcher agents** — Receive chapter chunks, produce Lean formalizations of definitions + theorem statements (with `sorry` for missing proofs)
2. **Prover agents** — Receive theorems with missing proofs, fill them. Can escalate problems via issue tracker or fix directly
3. **Reviewer agents** (two types per PR):
   - **Mathematical reviewer** — Does the formalization accurately reflect the source text?
   - **Engineering reviewer** — Code quality, conventions, naming, documentation, API design
   - Verdicts: approve / request changes / reject
4. **Maintainer agents** — Pick up open issues from the tracker, "make progress" (resolve fully or commit helpful code)
5. **Triage agents** — Review open issues, mark resolved ones
6. **Scan agents** — Scan codebase for global issues (duplication, refactoring opportunities, convention mismatches)
7. **Progress agents** — Track progress on target theorems specifically, preventing "derailing" onto side issues

### Coordination Via Standard Software Engineering

The key insight: **no bespoke message-passing protocol was needed.** Instead:

- **Git trunk-based development** — Short-lived feature branches per agent
- **Pull request review** — Every PR gets mathematical + engineering review from independent reviewer agents
- **Merge queue with staging branches** — Main always builds (CI-style)
- **File-system-based issue tracker** — Folder with short text files describing tasks. Agents create, resolve, and check issues. Issues ARE the shared communication protocol.
- **Git worktrees** — Each agent works in its own lightweight worktree, sharing the mathlib installation

### Tool Suite (5 Categories)
- **File tools**: read, write, edit (search-replace + line-range + copy/cut-paste)
- **Lean tools**: REPL snippet execution, mathlib search (file, grep, declaration regex)
- **Git tools**: status, add, log, diff, commit, rebase, reset (write-access only to own branch)
- **Bash tools**: allowlisted safe commands (lake, grep, sed, awk, etc.) — piping allowed, output writing blocked
- **Issue tracker tools**: create-issue, list-issues

### Scale Statistics
| Metric | Value |
|---|---|
| Target theorems/definitions | 340 (all proved) |
| Lean source files | 52 |
| Lines of Lean code | ~130,000 |
| Lean declarations | ~5,900 |
| Successful agents (merged PRs) | ~3,300 |
| Total agents launched | ~30,000 |
| Source text | ~500 pages, graduate-level |
| Runtime | ~1 week |
| Cost | ~$100K (~$200/page, ~$300/theorem) |

### Two-Phase Progress Pattern
Figure 1 shows a clear two-phase structure:
1. **Expansion phase**: Continuous codebase growth, including "rabbit hole" content (unnecessary tangents)
2. **Cleanup phase**: Triggered by prompt update, agents focus on removing unnecessary code and completing targets

The ~10% merge rate (3,300 successful of 30,000 launched) reflects the strictness of the review process — most agents' work is rejected or superseded.

### Issues Resolved Via Agent Communication
Examples of cross-agent coordination through the issue tracker:
- Replace proof strategy requiring fewer hypotheses
- Refactor files for code reuse / reduce duplication
- Restructure proofs to avoid false sub-goals
- Replace placeholder definitions with true definitions + refactor downstream
- Transfer proofs from coarse to fine-grained objects

## Why This Is a Landmark

### 1. Largest Verified Multi-Agent Software Engineering
Previous multi-agent code generation efforts (Lin2026ScalingAgents, Carlini2026BuildingCCompiler) produced large codebases but with "coherence issues." This work produced 130K lines that **formally verify** — the Lean compiler certifies every proof. The output isn't just large; it's *correct*.

### 2. Standard Practices Win Over Bespoke Orchestration
The paper explicitly addresses the coordination problem through battle-tested human practices:
- Git + trunk-based dev = conflict tracking
- PR review = quality control + preventive coordination
- Issue tracker = shared communication protocol
- Feature branches = fearless concurrency

This validates our architecture's approach of using filesystem-based coordination. They don't need Redis queues or custom message buses — **git + files + review cycles** are sufficient for 30K agents.

### 3. Economics of Automated Formalization
At ~$100K for a graduate textbook, this is already competitive with human expert teams (they note the cost "matches or undercuts" estimated salaries for equivalent human effort). The paper suggests "large efficiencies to be made without better models" — i.e., better orchestration alone could reduce costs significantly.

### 4. The Three Generations Framework
The paper defines three generations of autoformalization:
1. **Bespoke models** — Standalone problems (IMO, Putnam)
2. **Single-agent coding assistants** — Repository-level but sequential (Urban2026)
3. **Multi-agent scaffolds** — Parallel collaboration on shared codebase (THIS PAPER)

Generation 3 is what enables scaling to textbook-length formalizations.

## Connections to Our System

### Direct Architectural Parallels
| Their Pattern | Our Pattern | Status |
|---|---|---|
| File-system issue tracker | Filesystem-based agent coordination | ✅ Already using |
| Git trunk-based development | Git for state management | ✅ Already using |
| PR review by independent agents | Agent output review (partial) | 🔶 Not systematic |
| Sketcher → Prover decomposition | Task decomposition by role | ✅ Already using |
| Progress agents preventing derailing | Heartbeat progress tracking | ✅ Already using |
| Scan agents for global issues | No equivalent | ❌ Gap |
| Triage agents for stale issues | No equivalent | ❌ Gap |

### Key Gaps They Fill
1. **PR Review as Quality Gate**: Every agent's output is reviewed by TWO independent reviewers before merge. We don't have systematic output review. This directly addresses DD#541's finding about quality regression — review agents would catch degraded outputs.

2. **Scan/Triage Agent Roles**: Dedicated agents for codebase health (scan) and issue hygiene (triage) prevent accumulation of technical debt and stale tasks. We should add these roles.

3. **The ~10% Merge Rate**: Only ~3,300 of ~30,000 agents produced work that merged. This implies massive redundancy — but the verified output quality justifies it. **Quality gates + redundancy > efficiency + risk.**

### Connections to Previous Deep Dives
- **DD#521 (Imbue mngr)**: mngr used an "integrator agent" pattern; this paper uses PR review + merge queue instead. Both solve the same problem (multi-agent code integration) differently. The formalization paper's approach is more scalable (no single integrator bottleneck).
- **DD#534 (Power Laws in MAS)**: This paper's 10% merge rate suggests a heavy-tailed contribution distribution — a few agents likely contribute disproportionately. The DTI metric from DD#534 would be interesting to compute here.
- **DD#539 (MemCoder)**: MemCoder uses git history as training signal. This paper generates massive git history (30K agents × commits). Could this git history be used as a training signal for future formalization agents?
- **CR#290 (MAS Scaling Paradox)**: This paper is a COUNTER-EXAMPLE to the scaling paradox — 30K agents DO produce better results than a single agent could. The key difference: **formal verification as an objective quality gate** eliminates the sycophancy and coordination failures that plague deliberation-based MAS.
- **CR#289 (Agent OS)**: Maps to all 5 layers — Security (git permissions), Execution (worktrees), Evolution (issue tracker feedback), Verification (Lean compiler), Economics (~$200/page).

## The Key Insight for MAS Design

**Formal verification changes the game for multi-agent systems.** When you have an objective, automated quality checker (Lean compiler), you can:
1. Launch agents massively in parallel (fearless concurrency)
2. Accept high rejection rates (90% of agents' work rejected)
3. Trust that merged work is correct (compiler guarantees)
4. Scale linearly with compute, not communication complexity

This is why 30K agents worked here but similar-scale MAS often fail at deliberation tasks: **the coordination bottleneck is eliminated by objective verification.** The merge queue + Lean compiler replaces the need for agents to *agree with each other* — they just need to produce *correct code*.

## Predictions

- **P296**: Within 12 months, at least 3 major math departments will adopt AI-formalized textbook content into their curriculum, citing this paper's methodology
- **P297**: The git + PR review + issue tracker pattern will become the standard scaffold for multi-agent software engineering projects exceeding 100 agents, displacing bespoke orchestration protocols
- **P298**: Meta/FAIR will formalize at least 5 more textbooks using this system within 2026, creating the largest corpus of AI-generated formal mathematics
- **P299**: The ~10% merge rate will be shown to be improvable to ~30%+ through better task decomposition and agent prompting, without changing the review strictness — i.e., most of the 90% rejection is avoidable waste, not necessary redundancy
