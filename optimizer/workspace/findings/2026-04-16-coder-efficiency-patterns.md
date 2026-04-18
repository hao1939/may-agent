# Coder Efficiency Patterns — What Makes Low-Op Sessions Succeed

**Date**: 2026-04-16  
**Mode**: C (Skill & Technique Scouting)  
**Sample**: 393 coder sessions in last 6h, avg 8.2 ops (not 11 as hypothesized)

## Key Finding: The 6-10 Op Sweet Spot

Coder's best quality AND efficiency comes from **6-10 op sessions** (avgQ=0.84, avgE=0.75), not the shortest ones. Zero-op sessions are the worst performers (avgQ=0.55, avgE=0.60) — these are typically refusals or blocked tasks.

## Op Bucket Breakdown

| Bucket | Count | Avg Quality | Avg Efficiency | Avg Wasted Calls |
|--------|-------|-------------|----------------|------------------|
| 0-ops  | 158 (40%) | 0.55 | 0.60 | 5.6 |
| 1-5    | 67 (17%)  | 0.80 | 0.74 | 0.0 |
| 6-10   | 57 (15%)  | **0.84** | **0.75** | 0.0 |
| 11-20  | 71 (18%)  | 0.78 | 0.71 | 0.0 |
| 21+    | 40 (10%)  | 0.77 | 0.65 | 0.4 |

## Top-Performing Session Patterns (quality≥0.85, efficiency≥0.85)

Examining the 15 highest-efficiency good sessions reveals 3 reusable patterns:

### Pattern 1: Surgical Edit with Spec-Provided Code (3-6 ops)
Sessions scoring 0.88-0.95 quality at 3-6 ops follow: read target lines → edit exact text → verify with grep → tsc. The task provides exact code snippets to insert. Coder doesn't explore — it executes.
- **Example**: Add 5 sub-categories to tool-quality-scan.ts (3 ops, Q=0.90, E=0.88)

### Pattern 2: Create-from-Spec (6-10 ops)  
Tasks that say "create this file with this behavior" get implemented in 6-10 ops: read reference → write implementation → write test → run tsc+test. Zero exploration waste.
- **Example**: cost-limit-guard.ts (6 ops, Q=0.95, E=0.90)

### Pattern 3: Multi-File with Clear Blueprint (10-19 ops)
Larger tasks with exact file locations and code blocks. Coder reads each target, applies changes sequentially, verifies at end.
- **Example**: agents.run action across 2 files (19 ops, Q=0.87, E=0.86)

## Bottom-Performing Session Patterns

### Anti-Pattern 1: Zero-Op Refusals (40% of all sessions!)
158 sessions with 0 ops. Many are MISAPPLIED_REFUSAL — coder refuses legitimate tasks citing P104 or security concerns incorrectly. Others are blocked by environment issues.
- **Impact**: These drag coder's overall quality to 0.55 in the 0-op bucket

### Anti-Pattern 2: QA Fix Spirals (wastedCalls=12-33)
QA fix tasks where coder wastes 12-33 calls. Common pattern: reads broadly, tries multiple approaches, can't converge.
- **Example**: drain-todo.ts fix (Q=0.10, E=0.15, 29 wasted calls)

## Propagatable Techniques

1. **Spec completeness is the #1 efficiency driver** — Coder's best sessions all have tasks with exact code snippets, line numbers, and file paths. Tasks that say "fix this" without specifics produce the worst sessions. This is a **task design** pattern, not an agent pattern.

2. **Zero wasted calls in 1-10 op range** — Coder achieves literally 0.0 avg wasted calls for sessions 1-10 ops. The waste only appears in 0-op (refusal waste) and 21+ (exploration waste).

3. **Read-edit-verify triad** — Top sessions use exactly: read target → edit → verify (grep/tsc). No file discovery, no broad reads, no exploration.

## Actionable Recommendations

1. **For task dispatchers (tech-lead)**: Include exact code snippets, line numbers, and file paths. Coder converts spec-complete tasks to code at 0.88+ efficiency. Vague tasks produce 0.15 efficiency spirals.

2. **For coder's 0-op refusal problem**: 40% zero-op rate is the biggest efficiency drain. The MISAPPLIED_REFUSAL pattern (refusing self-edits citing P104) needs a structural fix — the P104 SOUL.md patch was already attempted but coder refused that too.

3. **For other agents**: The read-edit-verify triad with zero exploration is worth studying. Coder doesn't "discover" its codebase — it trusts the spec and executes. Other agents (coach, optimizer) spend 30-60% of ops on file discovery.

## Conclusion

Coder's low avg ops (8.2) is a **bimodal distribution**, not uniform efficiency. The efficient mode (1-10 ops, 0 wasted calls, Q≥0.80) is genuinely excellent and driven by spec-complete tasks. The inefficient mode (0-op refusals at 40%, QA fix spirals) drags the average down. The #1 lever is task quality from dispatchers, not agent behavior changes.
