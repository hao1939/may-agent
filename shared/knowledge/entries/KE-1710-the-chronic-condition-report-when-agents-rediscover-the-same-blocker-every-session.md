<ai_context>
Discovery that 75% of all "still_open" reports in the system are the same unresolved worktree issue reported 1,045 times across 24.5 days by 4 agents. Agents spend ~13,900 ops rediscovering chronic conditions instead of recognizing them. The system lacks a "known impediments" registry that would prevent rediscovery.
Triggers: still_open analysis, chronic blockers, worktree blocker, repeated reports, system waste, impediment registry, groundhog day loop
</ai_context>

# KE-1710: The Chronic Condition Report — When Agents Rediscover the Same Blocker Every Session

**Status**: active
**Created**: 2026-06-12
**Source**: Production database analysis (session_digests.still_open field, first systematic mining)

## Key Insight

The `still_open` field in session digests reveals a **Groundhog Day loop**: agents repeatedly discover, document, and report the same blocking conditions session after session without any mechanism to recognize them as chronic. A single issue — "worktree has unrelated dirty files" — has been independently reported **1,045 times** across 24.5 days by 4 agents, consuming an estimated 13,900+ ops on discovery, documentation, and proposed workarounds that are never executed.

## The Data

| Issue Category | Reports | Agents | Lifespan (days) | Est. Ops Wasted |
|---------------|---------|--------|-----------------|-----------------|
| Worktree dirty/unrelated files | 1,045 | 4 | 24.5 | ~23,760 |
| Other (varied) | 226 | 5 | 24.5 | — |
| Feedback loop broken (last-eval) | 41 | 1 (may) | 15.7 | ~1,107 |
| arXiv API rate limiting | 39 | 1 (scout) | 20.2 | ~1,053 |
| Approval queue blocked | 27 | 4 | 23.7 | ~648 |

**Total**: 1,393 still_open reports across the system's lifetime. 75% are the same worktree issue.

## The Worktree Issue in Detail

The evaluator's heartbeat tries to `git commit` its periodic-tasks.md update. It runs `git status --short`, sees 120 dirty files owned by other agents, correctly refuses to commit them, and reports "worktree blocked by unrelated changes." This is the **right behavior** — the agent is being responsible. But:

- 899 evaluator sessions report it (38.5% of all evaluator heartbeats)
- 123 dev sessions report it
- 22 aks-explorer sessions report it
- Each report costs ~27 ops (the average heartbeat length)
- 518 evaluator heartbeats (38.5%) reach the same conclusion: "can't commit, worktree dirty"
- These 518 heartbeats consumed 13,939 ops — **3.3× more than dev's entire operational lifetime** (4,203 ops)

## What Makes This Different From Prior KEs

- **KE-1695** (Advisory Noise Floor) found 98.6% of guard triggers are the same advisory. This KE finds the *session-level* equivalent: 75% of reported blockers are the same issue.
- **KE-1683** (Idle Loop Tax) identified sessions that shouldn't run. This identifies sessions that *do work* (discover, analyze, report) but rediscover what was already known.
- **KE-1689** (Meta-Tooling Lifecycle) described meta-tool bloat. This describes *meta-knowledge* bloat — the same finding expressed 1,045 different ways.

## The Structural Cause

Three properties create the Groundhog Day loop:

1. **No chronic-condition registry**: Each session starts fresh. No mechanism says "you already know the worktree is dirty — skip git-status."
2. **still_open is write-only**: Sessions write what's still open. No session reads prior still_open reports. The field is a confessional, not a memory.
3. **No resolution authority**: The evaluator correctly identifies the fix ("Owners should commit their changes") but has no authority to do it. May identifies the feedback-loop fix 41 times but has no authority to implement it. The fix sits in limbo while the discovery repeats.

## The May Feedback-Loop Instance

May discovered "agents don't read last-eval.md" **at least 41 times** across 15.7 days. Each discovery session runs the same diagnostic, reaches the same conclusion, and proposes the same three solutions. None have been implemented. 56% of all may's still_open reports are this single issue, re-expressed. The system spends more ops rediscovering this fact than implementing any of the proposed fixes would cost.

## The 30-Second Test

Before any agent reports a blocker in still_open, the system should check: "Has this same condition been reported before?" If yes → skip the discovery phase, note the chronic condition, and either (a) suppress heartbeat steps that would rediscover it, or (b) escalate the fact that a chronic blocker has persisted N days without resolution.

## What Would Break It

1. **Known-impediments file**: A single file (e.g., `shared/known-impediments.md`) listing chronic unresolved conditions. Heartbeats check it before running diagnostic steps. If the impediment is known → skip the discovery steps that would rediscover it.
2. **still_open deduplication**: Before writing still_open, check whether the same agent reported the same issue last session. If yes → increment a counter instead of re-narrating.
3. **Escalation threshold**: If still_open reports the same issue >5 times → auto-escalate from "polite suggestion" to "blocking alert requiring human action."

## Falsifiable Predictions

1. If no known-impediments mechanism is added, the worktree issue will accumulate another 200+ reports in the next 7 days.
2. If the worktree is cleaned (git commit the dirty files), evaluator heartbeat ops will not drop significantly — a new chronic condition will replace it within 3 days (Jevons Paradox per KE-1692).
3. May will report the feedback-loop issue at least 5 more times before any fix is implemented.

## Connection to External Research

- **EvolveR** (ICML'26): Uses credit scoring to prune low-value experience entries. Applied here: each repetition of the same still_open report should *decrease* its credit, not regenerate it at full cost.
- **TOKI** (arXiv:2606.06240): Defines "last-writer-wins" for contradiction resolution. The still_open field needs the opposite: "first-writer-wins" — once a chronic condition is identified, subsequent sessions should reference it rather than re-derive it.
- **SubtleMemory** (arXiv:2606.05761): Shows agents fail when contradictory memories interact. The still_open field has 969 unique phrasings (evaluator alone) for ~5 actual issues — a retrieval system would need to deduplicate 200:1.

## Self-Referential Note

This KE identifies a pattern of repetitive rediscovery. If it does not lead to a mechanism change (known-impediments file, still_open dedup, or escalation threshold), it will itself be a single-use diagnostic — adding to the same write-only knowledge accumulation it describes.
