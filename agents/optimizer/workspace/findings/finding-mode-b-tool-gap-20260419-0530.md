# Finding: Tool Gap Analysis — 6h scan (2026-04-19 05:30)

**Mode**: B — Tool Gap Analysis  
**Window**: Last 6 hours (sessions since ~23:30 UTC Apr 18)  
**Sessions sampled**: 5 high-op sessions (64, 31, 23, 19, 15 ops)

## Key Patterns Found

### 1. PATH Setup Repetition (HIGH frequency)
**Pattern**: `export PATH=".state/.bun/bin:$PATH"` appears 12+ times in a single session (s_1776562571972_797), and 3-4 times in others.  
**Impact**: ~2-5 wasted ops per session across the system.  
**Already mitigated?**: No. Each `bun -e` call requires a fresh PATH since bash calls don't share environment.  
**Recommendation**: This is inherent to the tool model (each bash call is independent). No action needed — it's a false positive that looks wasteful but isn't fixable without shell persistence.

### 2. grep-n → sed-n Code Browsing (MEDIUM frequency)
**Pattern**: `grep -n 'keyword' file` followed by `sed -n '240,300p' file` — a two-step pattern to find then read code sections. Seen 6+ times in s_1776563469482_804.  
**Impact**: 2 bash calls where 1 `read()` with offset could suffice, or `grep -B5 -A20` in one call.  
**Already mitigated?**: The `read()` tool exists and handles this. Agents just don't use it consistently for code exploration.  
**Recommendation**: No new tool needed. This is a behavior/skill issue — agents should prefer `read()` over grep+sed for code browsing. Could add a tip to context.md.

### 3. git add + commit Ceremony (MEDIUM frequency)
**Pattern**: `cd agents && git add -A && git commit -m "..."` or variations with specific paths, sometimes preceded by `git status`. Seen in 4/5 sampled sessions.  
**Impact**: 1-3 ops per session. Consistent but low overhead.  
**Already mitigated?**: No dedicated tool, but the pattern is simple enough that a tool wouldn't save much.  
**Recommendation**: No action. A git-commit tool would save ~1 call at most.

### 4. bun -e Database Query Boilerplate (MEDIUM frequency)  
**Pattern**: Every DB query requires `import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); ...`  
**Impact**: ~30 chars of boilerplate per query. Not a tool-call waste but adds cognitive load.  
**Already mitigated?**: No.  
**Recommendation**: Low priority. A `db-query` helper script could reduce this but the pattern is well-established and copy-pasteable.

## Summary

No significant tool gaps found in this scan. The main inefficiencies are:
- **Behavioral** (grep+sed instead of read()) rather than tooling gaps
- **Structural** (PATH re-export) rather than fixable

**Actionable**: Consider adding to agent context: "Prefer read() with offset over grep+sed for code browsing."

## Scan Metadata
- Sessions in window with opCount > 5: 10
- Sampled: s_1776563469482_804 (64 ops), s_1776558283950_741 (31), s_1776562571972_797 (23), s_1776557170525_726 (19), s_1776558151349_734 (15)
