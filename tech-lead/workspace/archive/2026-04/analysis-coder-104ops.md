# Analysis: Coder 104-op Session (s_1775971602013_1886)

**Date**: 2026-04-12  
**Session**: `s_1775971602013_1886` (coder, 104 ops, 10m17s)  
**Parent**: `s_1775971448515_1880` (tech-lead, "Lens C: Evaluation system dead weight")  
**Workflow**: verified-coder (`wr_1775971602013_g9jv`)  
**Outcome**: Session claimed "success" but verification failed → workflow retried (attempt 2: 2 ops, 39s)

## Task

Remove dead evaluation code (6 functions/interfaces from evaluator.ts + imports from 4 other files). Well-specified with exact line numbers for 5 files. Genuinely complex task: removing ~810 lines of scattered code across a 1640-line file.

## Op Breakdown (121 tool calls, 105 turns)

| Phase | Turns | Tool Calls | Description |
|-------|-------|------------|-------------|
| 1. Investigation | 1–16 | 32 | grep, sed, read to understand code before editing |
| 2. Simple edits | 17–26 | 12 | may.ts, agent-loader.ts, handler-context.ts, index.ts — all clean |
| 3. evaluator.ts struggle | 27–57 | ~45 | **THE BLOAT** — 30 ops of failed edit() attempts on evaluator.ts |
| 4. Rebuild + cleanup | 58–104 | 32 | git checkout, rebuild file from parts, fix tests, verify |

## Root Cause: Sequential Edit Spiral on Large File

The coder tried to remove 6 scattered functions from a 1640-line file using incremental `edit()` calls. What happened:

1. **Turn 27**: First edit removed `readFileSync` import + `FrustrationSignals` interface — worked fine
2. **Turn 30**: Second edit removed part of `detectFrustrationSignals` — but only the header, not the body
3. **Turns 31–46**: 15 turns of increasingly confused attempts to fix the partial removal. Each `sed -n` inspection revealed more problems: duplicate imports, orphaned function bodies, line number drift
4. **Turn 47**: Coder recognized "this piecemeal approach is getting messy" — but continued trying
5. **Turn 57**: Finally did `git checkout src/lib/evaluator.ts` to revert
6. **Turns 58–70**: Rebuilt the file from scratch using `cat` + `sed` to extract only the parts to keep → **this worked in ~12 ops**

**The rebuild approach (turns 58-70) should have been the first approach.** The 30 ops of incremental edit() attempts (turns 27-57) were pure waste.

## Is This Systemic?

**Partially.** This is the only 100+ op coder session in 24h, but the pattern (incremental edit on large files failing) is a known anti-pattern. The mitigation already exists in the tech-lead's delegation instructions — the task included "Before EVERY edit(): read() the file first to get exact text." The coder did follow this, but the real problem was **strategy**, not process:

- For files with scattered deletions (>5 edit regions in a large file), `edit()` is the wrong tool
- The right approach is: extract-parts-to-keep → write new file (or write() the full new content)

## Recommendations

1. **No systemic fix needed** — this was a genuinely complex task (removing 810 lines from a 1640-line file), and the coder eventually self-corrected by switching strategies. The total cost (104 + 2 = 106 ops) vs ideal (~50 ops for this task) represents ~50% overhead, not a 10x blowup.

2. **Delegation heuristic**: When delegating tasks that require removing >100 lines or >3 scattered regions from a single file, add a hint: "For large multi-region deletions, rebuild the file from parts rather than sequential edit() calls."

3. **Not a workflow issue**: The verified-coder workflow worked correctly — it ran coder, ran verification (which failed because of the messy edit state), then retried. The retry was cheap (2 ops).

## Verdict

**Legitimate complex task with avoidable overhead.** ~45 of 104 ops were wasted on a failed editing strategy. No systemic fix required, but a delegation hint for future similar tasks would help.
