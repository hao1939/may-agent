# Meta FAIR: 30K-Agent Textbook Formalization

**Source:** arXiv:2604.03071 (Apr 3, 2026)  
**Authors:** Fabian Gloeckle, Ahmad Rammal, Charles Arnal, Remi Munos, Vivien Cabannes, Gabriel Synnaeve, Amaury Hayat (Meta FAIR)  
**Labels:** #multi-agent #coordination #scaling #formal-verification #git

---

## Core Result

Meta FAIR successfully formalized a **500-page graduate-level algebraic combinatorics textbook** to Lean in **one week** using **30,000 Claude 4.5 Opus agents** working in parallel.

**Key numbers:**
- 130,000 lines of Lean code
- 5,900 Lean declarations  
- 340 target theorems/definitions (all proved)
- ~3,300 successful agents (out of 30K launched)
- ~$100K inference cost (~$200/page, ~$300/theorem)
- Cost matches or undercuts estimated human expert salaries

---

## Architecture: Multi-Agent Scaffold

The system uses **git-based coordination** with human-like software engineering practices:

### Agent Roles
| Role | Function |
|------|----------|
| **Sketcher** | Creates theorem statements, definitions (with `sorry` for proofs) |
| **Prover** | Fills in proofs, escalates issues to tracker |
| **Reviewer (Math)** | Checks if statements match source material |
| **Reviewer (Eng)** | Checks code quality, conventions, API design |
| **Maintainer** | Makes progress on open issues |
| **Triage** | Identifies resolved issues |
| **Scan** | Finds global issues (duplication, refactoring needs) |
| **Progress** | Tracks target theorem completion, prevents "derailing" |

### Coordination Mechanisms
1. **Git trunk-based development** — short-lived feature branches
2. **Pull request review** — independent reviewers, clear quality guidelines
3. **Merge queue with staging** — main branch always builds
4. **Filesystem-based issue tracker** — simple text files, no bespoke messaging

> "Shared files provide a direct, simple and universal communication protocol for agents without the need for bespoke solutions for message passing."

---

## Key Insights

### What Worked
- **Standard engineering practices scale** — no heavy orchestration logic needed
- **Git provides natural conflict tracking** — interface agents already master
- **Issue tracker enables complex coordination**:
  - Replace proof strategies requiring fewer hypotheses
  - Refactor files for code reuse
  - Restructure proofs to avoid false sub-goals
  - Transfer proofs between function variants

### Tool Design
Agents have structured tools in four categories:
1. **File tools** — read/edit with line numbers, search/replace
2. **Lean tools** — REPL execution, mathlib search
3. **Git tools** — status, add, log, diff, commit, rebase (write access limited to own branch)
4. **Bash tool** — allowlisted commands only (lake, cat, grep, etc.)

All tools have **automatic truncation** to prevent context overflow.

---

## What This Means for Our System

### Multi-Agent Scaling
The 30K-agent milestone reframes multi-agent scaling from "impossible" to "requires proper coordination." Key requirements:
- **Partitionable tasks** (chapters → theorems → proofs)
- **Shared state with conflict resolution** (git)
- **Explicit cleanup phases** (the "cleanup" phase visible in progress charts)

### For Thread 10 (Multi-Agent Paradigm)
This validates that massive horizontal scaling is viable when tasks are partitionable and coordination uses proven engineering patterns. The "30K agents" number is now a benchmark others will reference.

### Cost Efficiency
At $200/page and $300/theorem, automated formalization is approaching economic viability vs. human experts — without requiring better models, just better orchestration.

---

## Open Questions

- How does this coordination pattern apply to non-formalization domains?
- What's the failure mode analysis? (3,300 successful / 30K launched = 11% success rate per agent)
- How does the system handle dependency chains between theorems?

---

**Code:** https://github.com/facebookresearch/repoprover  
**Formalization:** https://github.com/facebookresearch/algebraic-combinatorics
