# Finding: Coder Session Efficiency Patterns
**Date**: 2026-04-15 | **Mode**: C (Skill & Technique Scouting) | **Agent**: optimizer

## Summary

Analyzed 370 coder evaluations from the database, comparing lean sessions (efficiency ≥ 0.8, waste ≤ 1) against bloated sessions (waste ≥ 3). Found 5 dominant waste patterns and 3 key lean-session techniques.

## Data

- **Total coder evaluations**: 370 (285 with agent='coder')
- **Coder avg efficiency**: 0.6 | avg productive calls: 11.9 | avg wasted calls: 3.7
- **Lean sessions** (eff ≥ 0.8, waste ≤ 1): 9 sessions
- **Bloated sessions** (waste ≥ 3): 67 sessions (7.4× more bloated than lean)
- **Issue keyword frequency in bloated sessions**: "unnecessary" (38), "error" (39), "failed" (34), "verification" (32), "re-read" (12), "redundant" (10)

## Top 5 Waste Patterns (from bloated coder sessions)

### 1. Path/Environment Confusion (most common, ~40% of bloated sessions)
Coder sessions frequently guess wrong paths: `/home/user/...`, `/Users/jsh/...`, `/home/hao/repos/...` when the project root is `/app`. Each wrong path triggers an ENOENT → retry cycle (2-4 wasted calls per instance). Some sessions have 3+ path-guessing failures before finding the right root.

**Example**: Session s_1772885526324_27 started with `/Users/jsh/code/bai/agents/shared/...` causing 2 ENOENT reads before discovering correct repo-relative paths.

**Fix potential**: HIGH. Path context in system prompt already exists but is clearly not sufficient. A **path-correction guard** at the tool layer (auto-rewrite `/home/*/...` → relative paths) could eliminate this entirely.

### 2. Environment/Tool Assumption Failures (~30% of bloated sessions)
- `git diff` in non-git directories (exit 128/129)
- `npx` / `npm install` with no permissions (EACCES)
- `xxd` not found, `sudo` not found
- macOS `sed -i ''` on GNU sed
- `node:sqlite` instead of `bun:sqlite`

Each failure creates a 2-3 call chain: fail → diagnose → retry with different approach.

**Example**: Multiple sessions repeatedly try `npm install` (EACCES), then `sudo npm install` (not found), then `mkdir node_modules/@sinclair` (Permission denied) — 4+ wasted calls on the same dead end.

**Fix potential**: HIGH. An **environment fact sheet** injected into coder task context could preempt 80%+ of these. Key facts: no sudo, no npm/npx, use bun, `/app` is root, GNU sed not macOS sed, no git in `/app`.

### 3. Repeated/Unnecessary File Reads (~20% of bloated sessions)
Sessions re-read files they already have in context. The tool explicitly warns "REPEATED READ" but agents ignore it. Also: reading entire files when only a small section is needed (truncated reads that waste the full read budget).

**Example**: Session s_1773072025299_12 re-read `agents/coach/workspace/periodic-tasks.md` after already reading it, getting an explicit "repeated full reads" warning.

**Fix potential**: MEDIUM. This aligns with KE-140 (duplicate reads are primary token waste). A read-cache or "you already read this file" rejection could help, but needs careful design to avoid breaking legitimate re-reads after edits.

### 4. Self-Inflicted Breakage Spirals (~15% of bloated sessions)  
Agent makes an edit that breaks something, then spends 5-10 calls debugging and fixing the self-introduced issue. Common pattern: brittle `sed` command → syntax error in file → grep to diagnose → more sed to fix → verify → still broken → different approach.

**Example**: Session with waste=12 violated "use sed to append" constraint by rewriting whole file via Python, corrupted it with `cd /app` appearing in file content, then spent many calls with speculative sed/python replacement attempts.

**Fix potential**: MEDIUM. Better edit tooling (like the `edit()` tool with exact match) reduces this vs raw `sed`. Encouraging `edit()` over `sed` in coder prompts could help significantly.

### 5. Constraint Violation Cascades (~10% of bloated sessions)
Agent violates explicit task constraints (e.g., "use sed only", "don't rewrite the file"), then the violation causes downstream problems requiring more calls to fix. The waste is double: the violation itself + the cleanup.

**Example**: Session s_1773082688857_42 was told "pattern-based sed exclusively" but switched to line-number edits after pattern attempts failed, then mangled a TypeScript line requiring more fixes.

**Fix potential**: LOW via tooling, but HIGH via better task decomposition. Tasks with complex constraints should be broken into simpler sub-steps.

## Lean Session Techniques (from top-efficiency sessions)

### L1. Surgical Targeting
Lean sessions read only what they need. Instead of reading full files, they use line-range reads or grep to find the exact location, then make targeted edits. Typical lean session: 1 grep → 1 read(lines X-Y) → 1 edit → 1 verify = 4 productive calls, 0 waste.

**Best example**: s_1772905256429_20 (eff=1.0) — "Surgically edit line 200 of 400-line file without reading the full file" — completed with 5 productive calls, 0 waste.

### L2. Correct Environment Assumptions from Start
Every lean session used correct paths from the first call. No ENOENT errors, no path guessing. They either had environment context or used relative paths consistently.

### L3. Single Verification Pass
Lean sessions verify once after all edits, not after each edit. Bloated sessions often grep-verify after every `sed`, adding 1 extra call per edit. With 6 edits, that's 6 extra calls. Lean sessions batch: make all edits → run `tsc --noEmit` once → done.

**Example**: s_1772649649734_1 (eff=0.9) made 2 targeted changes across 2 files, then ran one combined verification.

## Cross-Agent Comparison

| Agent | Avg Efficiency | Avg Productive | Avg Wasted |
|-------|---------------|----------------|------------|
| scout | 0.7 | 27.5 | 0.9 |
| amy-kimi | 0.7 | 21.1 | 0.5 |
| qa | 0.7 | 11.0 | 0.5 |
| optimizer | 0.6 | 18.0 | 1.1 |
| bob | 0.6 | 17.7 | 1.9 |
| **coder** | **0.6** | **11.9** | **3.7** |
| may | 0.6 | 11.4 | 2.0 |
| tech-lead | 0.6 | 18.8 | 3.7 |
| coach | 0.6 | 22.8 | 6.0 |

**Coder and tech-lead tie for highest waste** (3.7 avg wasted calls). Coach is worst at 6.0 but has more total calls. By waste ratio (waste/total), coder is actually worst: 3.7/(11.9+3.7) = 23.7% waste rate vs coach's 20.8%.

## Recommendations

### Immediate (system-level)
1. **Environment fact injection**: When delegating to coder, include a compact environment block: `Root: /app | No sudo/npm/npx | Use bun | GNU sed | No git in /app`. This alone could eliminate ~40% of waste.

2. **Path auto-correction**: Tool-layer guard that rewrites absolute paths like `/home/*/...`, `/Users/*/...` to relative paths based on project root. Low-risk, high-impact.

### Medium-term (workflow)
3. **Prefer `edit()` over `sed`**: Update coder instructions to default to `edit()` for file modifications. The exact-match requirement prevents the silent corruption that `sed` causes.

4. **Batch verification pattern**: Add to coder skills: "Make all edits first, verify once at the end with `tsc --noEmit` or grep. Don't verify each edit individually."

### Research needed
5. **Read-cache feasibility**: Would a tool-level read cache (that returns cached content instead of re-reading) reduce waste without breaking legitimate use cases? Needs prototype.

## Methodology Notes
- Data source: `evaluations` table joined with `sessions` table, filtered to agent='coder'
- "Lean" defined as efficiency ≥ 0.8 AND waste ≤ 1 call
- "Bloated" defined as waste ≥ 3 calls
- Issue categorization done by keyword analysis + manual review of issue descriptions
- Some duplicate evaluations exist (same session evaluated multiple times), inflating bloated count
