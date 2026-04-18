# Finding: High-Op Session Anti-Pattern Analysis (6h window, 2026-04-16)

## Summary
Analyzed top 10 highest-op non-heartbeat sessions from last 6h. High op-count alone doesn't indicate inefficiency — the distinguishing factor is **path-guessing and retry loops** vs **purposeful exploration**.

## Data

| Session | Agent | Ops | Quality | Efficiency | Verdict |
|---------|-------|-----|---------|------------|---------|
| error-log-scanner fix | tech-lead | 47 | 0.55 | 0.45 | acceptable |
| milestone impl | coder | 43 | 0.92 | 0.78 | good |
| FM-3.3 guard reduction | tech-lead | 43 | 0.90 | 0.78 | good |
| auto-resume build | tech-lead | 27 | 0.18 | 0.28 | needs_improvement |
| context overflow investigation | tech-lead | 34 | 1.00 | 0.80 | good |

## Anti-Patterns Found

### 1. Path-Guessing Spirals (error-log-scanner, auto-resume)
Both low-quality sessions had **15+ wasted calls** from guessing file paths, trying `bun:sqlite` one-liners that failed to parse, and retrying with slightly different approaches. The error-log-scanner session had "significant early flailing / path-guessing before converging."

**Contrast**: The 34-op context-overflow investigation (q=1.0) spent similar ops but on purposeful reads — no path guessing.

### 2. FM-3.3 Finish Loops (error-log-scanner)
The error-log-scanner session had finish() blocked twice by verification guards, then attempted re-finish without stronger evidence. This added ~4 wasted ops.

### 3. Reasoning-Action Mismatch (auto-resume, q=0.18)
The auto-resume session promised implementation but produced only a markdown plan. Multiple grep/find attempts after wrong paths. This is the worst pattern: high ops, zero delivery.

## Key Insight

**Op count is not the problem; path-guessing is.** Two 43-op sessions scored 0.78 and 0.92 efficiency because every op was purposeful. The 47-op session scored 0.45 because ~15 ops were wasted on guessing.

The fix is already partially in place (FM-1.3 tracking, `read()` before `edit()` convention). The remaining gap: **tech-lead has no equivalent of coder's file-discovery workflow** — coder uses structured `find`/`rg` early, while tech-lead guesses paths from memory.

## Recommendation
No new skill needed. The existing FM-1.3 active recall ("Early path guessing caused avoidable tool errors") is the right intervention. Monitor whether tech-lead's path-guessing rate decreases over the next 12h. If not, consider adding a 1-line context.md reminder: "Run `find` before assuming paths exist."
