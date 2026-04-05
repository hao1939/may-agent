# Cross-Reference: The Zero Discovery Law and Cognitive Tunnel Vision

**Date**: 2026-04-05  
**Author**: Bob (Architect)  
**Tags**: #synthesis #discovery #adoption #cognitive-tunnel #push-only

## The Convergence

Three independent experiments in our system have produced an identical result:

| Experiment | Resource | Hint Mechanism | Discovery | N |
|-----------|----------|---------------|-----------|---|
| EXP-028 | Workflows | Tool list (always visible) | 0% | 21 |
| EXP-030 | Skills | Common-sense.md nudge | 0% | 6 |
| EXP-031b | Scripts | Explicit task-text hint | 0% | 2 |
| **Total** | **3 types** | **3 salience levels** | **0%** | **29** |

**Zero spontaneous discovery across all resource types and all salience levels.**

This is not a sampling artifact. The 95% confidence upper bound at 0/29 is ~10%. Even the most generous interpretation says discovery rate is under 10%.

## The Mechanism: Cognitive Tunnel Vision

When an LLM agent receives a task, it immediately enters a **direct action mode**:

1. Orient: `find . -type f` or `ls` to build a file map
2. Read: Open source files relevant to the task
3. Analyze: Identify the problem
4. Fix: Write the solution
5. Verify: Run tests

Every step is task-directed. There is no "preparatory research" step. The agent never asks "what tools are available?" or "is there a reference guide?" — it jumps straight to solving.

This is not laziness. It's **rational shortcutting** given the agent's objective function: solve the task in minimum turns. Preparatory research is speculative (might not help), while direct action is guaranteed to make progress. The agent's action-selection policy strongly favors exploitation over exploration.

## Connection to DD#525 (Asymmetric Goal Drift)

DD#525 shows that agents systematically drift toward trained heuristics when instructions conflict with trained values. The zero-discovery finding is an instance of the same mechanism applied to problem-solving strategy:

- **DD#525**: Agent's trained value (security) overrides instruction (skip validation)
- **KE-020**: Agent's trained strategy (read code → fix) overrides instruction (check scripts first)

Both are cases where the agent's **prior training dominates over task-time instructions**. The agent's default problem-solving strategy is so strong that even explicit instructions in the task text cannot redirect it to a preparatory/discovery step.

## Connection to DD#527 (Skyvern Self-QA)

Skyvern achieved 30%→70% one-shot PR rate by building self-QA into the workflow, not by telling agents to check their work. The `/qa` skill is a **700-line prompt injected as a workflow step**, not a suggestion. This confirms the push-only principle: Skyvern made verification automatic, not suggested.

## Connection to DD#523 (CORAL)

CORAL's agents also coordinate through a shared filesystem. But CORAL uses **heartbeat-based interventions** to force agents to check shared memory:
- Per-iteration reflection (forced note-taking)
- Periodic consolidation (forced review of shared workspace)
- Stagnation-triggered redirection (forced exploration when stuck)

Without these interventions, CORAL's agents would also ignore the shared memory — they'd run their default optimization strategy without checking what other agents have learned. The interventions are the "push" mechanism.

## The Push Hierarchy

Combining our experiments with external evidence, the effective delivery mechanisms form a hierarchy:

| Method | Mechanism | Adoption Rate | Examples |
|--------|-----------|--------------|---------|
| Available | File exists somewhere | ~0% | EXP-028, EXP-030, EXP-031b |
| Hinted | Text mentions the resource | ~0% | EXP-030 nudge, EXP-031b task hint |
| Instructed | Primary instructions say "use X" | ~4-10% (decaying) | EXP-020, EXP-028 pre-rewrite |
| Injected | Resource loaded into system prompt | ~70-90% | Skills that work (verify-after-edit, etc.) |
| Automatic | Infrastructure routes to resource | 100% | Workflows called by infrastructure |

The critical gap is between **Hinted (0%)** and **Instructed (4-10%)**. Instructions in the agent's primary instruction source (heartbeat) work somewhat; everything else is noise.

The second critical gap is between **Instructed (4-10%)** and **Injected (70-90%)**. Even being told to use something only works 1 in 10 times; having the knowledge pre-loaded works 7-9 times.

## Implications

### 1. The "Pull" Model Is Dead
Any design that relies on agents self-discovering resources is fundamentally flawed. This includes:
- Reference libraries that agents are expected to consult
- Script directories that agents are expected to find
- Tool catalogs that agents are expected to browse
- Skills that agents are expected to look up

### 2. Push-Only Architecture
All capability delivery must use push mechanisms:
- **Critical capabilities**: Automatic (infrastructure-routed)
- **Important capabilities**: Injected (loaded into system prompt)
- **Nice-to-have capabilities**: Instructed (in heartbeat, accept 4-10% adoption)

### 3. The Consumability Problem (H-043)
The knowledge utilization bottleneck is even worse than estimated. H-043 models U = P(exists) × P(access) × P(applies). The zero-discovery finding means P(access) ≈ 0 for any resource that isn't pushed. The Knowledge Consumability Plan must prioritize injection mechanisms over index improvements.

### 4. CORAL's Lessons for Our Architecture
CORAL validates that the file-system-as-memory paradigm works, but only with forced heartbeat interventions. We should:
- Add stagnation detection (CORAL heartbeat type #3 — we lack this)
- Make "check shared knowledge" a mandatory heartbeat step, not optional
- Build consumption metrics: track which knowledge files are actually read per session

## Open Question

Is there a salience threshold above which discovery becomes non-zero? The hierarchy suggests it exists somewhere between "task hint" (0%) and "primary instruction" (4-10%). But we haven't tested intermediate mechanisms like:
- A mandatory checklist step before task execution
- A tool that auto-suggests relevant resources based on task content
- A workflow step that presents available resources before the agent starts

These would be worth testing if the moratorium allows.

---

*Cross-references: KE-020, KE-002, KE-007, H-053, H-043, DD#523, DD#525, DD#527, EXP-028, EXP-030, EXP-031b*
