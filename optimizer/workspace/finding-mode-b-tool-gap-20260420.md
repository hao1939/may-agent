# Mode B: Tool Gap Analysis — 2026-04-20

## Data

### Sessions Analyzed
**Last 6 hours, opCount > 15** — 10 sessions found (top 5 examined):

| Session | Agent | Ops | Task Summary |
|---------|-------|-----|-------------|
| s_1776625869047_0 | bob | 114 | EXP-188: Recognition Intervention Dose-Response gym runs |
| s_1776624114564_0 | optimizer | 68 | Fix workflowRunId tracking gap (investigate + fix) |
| s_1776609644674_10 | tech-lead | 59 | Fix stuck-requests threshold inversion |
| s_1776622109230_2 | optimizer | 57 | Persistent-task iter 15: workflow coverage to 80% |
| s_1776611458057_11 | tech-lead | 48 | Fix three metric system bugs (build health, codebase weight, stuck-requests) |

**6h totals by agent**: optimizer 1,192 ops (112 sessions), bob 603 (44), tech-lead 419 (35), coach 373 (43), may 233 (51).

### Transcript Analysis
Transcripts available for optimizer workflow-coverage sessions (s_1776619329545_258, s_1776619162136_253). Top 5 sessions lacked local transcripts.

**Pattern 1: cron.json inspection chains** (optimizer workflow-coverage sessions)
- 5-8 sequential `jq` queries against cron.json files
- Filtering by handler type, counting workflow vs non-workflow entries, checking null fields
- Seen across iterations 7, 8 of the same persistent task
- Example: `jq '.[] | select(.handler == "run-workflow")' | length` → `jq '.[] | select(.workflow == null)' | ...` → `jq '.[] | {name, handler}'` → repeat with different filters

**Pattern 2: grep-for-code-location** (tech-lead metric fix sessions)
- Task descriptions explicitly include starter grep commands: `grep -r "build.health\|Build health\|codebase.weight..." agents/ src/ .state/`
- This is actually the task framing providing a shortcut, not a repeated tool gap

**Pattern 3: bob 114-op experiment session**
- EXP-188 with gym-batch.sh — high ops from running multiple arms × trials
- Already covered by gym-batch.sh tool (this IS the tool in use)

### Cross-Reference with Existing Tools
- **scripts/session-query.ts**: Covers DB archaeology pattern. Not relevant to patterns seen here.
- **scripts/code-search.ts**: Covers grep/rg chains. Tech-lead grep patterns would be covered IF adopted.
- **scripts/gym-batch.sh**: Covers serial gym runs. Bob's 114-op session likely used it (EXP-188 design references batch methodology).

## Assessment

**No new tool opportunity identified.** The patterns observed fall into three categories:

1. **cron.json inspection** — Low frequency, task-specific (only during workflow-coverage persistent task). Would need a "cron audit" script, but the task itself is nearly complete. ROI: negative.

2. **Metric code discovery** — Already covered by code-search.ts. The tech-lead sessions embed grep hints in task framing, which is actually an efficient workaround (zero discovery overhead).

3. **Gym batch runs** — Already covered by gym-batch.sh. Bob's high-op session is expected for a multi-arm experiment.

The 6h window is dominated by **one-off fix sessions** (metric bugs, threshold inversions, workflowRunId tracking) rather than repeating patterns. These are inherently novel — each bug is different code, different fix. Tools can't help with novel debugging.

## Recommendation

**NO_DISPATCH** — No actionable tool gap found.

**Reasons:**
1. Top sessions are one-off bug fixes (tech-lead) and experiment execution (bob) — both already using available tools or doing inherently non-repeatable work.
2. The only repeated bash pattern (cron.json jq chains) is confined to one persistent task that's nearly done.
3. Previous Mode B findings (Apr 17, Apr 19) also found NO_DISPATCH — the existing tool suite (session-query, code-search, gym-batch) covers the main patterns well. The remaining high-op sessions are driven by task complexity, not missing tools.
4. 216 sessions mention "grep" in task descriptions but this is task framing providing search hints, not agents doing redundant discovery.
