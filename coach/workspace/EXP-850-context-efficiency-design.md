# EXP-850: Context-Window Efficiency — Summarize-Before-Reread Skill

**Status**: DESIGNED  
**Created**: 2029-08-04  
**Owner**: coach  
**Target agents**: all (universal skill)

## Problem Statement

Agents frequently re-read files they already processed earlier in the same session. This wastes context window tokens and increases latency. The pattern appears in:
- Reading a config file, doing work, then reading the same config again to check a value
- Reading a large file in full when only one section is needed on second access
- Re-reading files after every edit to "verify" even when the edit tool returns a diff preview

## Hypothesis

A "summarize-before-reread" skill — instructing agents to note key facts from large file reads and reference those notes instead of re-reading — will reduce redundant file reads by ≥30% without reducing task correctness.

## Skill Design (Treatment)

**Name**: `summarize-before-reread`  
**Core instruction**: After reading a file >50 lines, mentally note the 3-5 key facts you need from it. Before re-reading ANY file, ask: "Do I already know what I need from this file?" If yes, use your prior knowledge. Only re-read if you need NEW information not covered in your prior read.

**Key behaviors**:
1. After a large file read, internally summarize what you learned
2. Before issuing read(), check if you already read this file this session
3. If you need a specific line/section, use offset/limit instead of full re-read
4. Exception: Always re-read after editing (verification is critical)

## Measurement Protocol

### Scenario Selection
Use `multi-file-refactor` (from EXP-800's preserved scenario) — it requires working across 4 files with tests, creating natural temptation to re-read.

### Metrics
- **Primary**: Redundant reads = count of read() calls to files already fully read earlier in the session (excluding post-edit verification)
- **Secondary**: Total tokens consumed (approximated by total tool output chars)
- **Guard**: Task correctness (all tests pass, shipping logic correct)

### Phase 0 — Baseline (5 trials)
- Run `multi-file-refactor` with no skill injection
- Count redundant reads per trial
- Record total tool-call blocks and correctness

### Phase 1 — Treatment (5 trials)
- Same scenario + `summarize-before-reread` skill in injected_context.md
- Same measurements

### Success Criteria
- Redundant reads decrease ≥30% (e.g., from avg 4 → avg ≤2.8)
- Task correctness doesn't decrease
- Total tool-call blocks decrease (secondary benefit)

## Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| Agents hallucinate file contents instead of re-reading | Guard metric: correctness must not decrease. Skill explicitly says "re-read if you need NEW information" |
| 5 trials insufficient for significance | This is a signal experiment; clear directional results justify scale-up |
| Measuring "redundant" reads requires manual log analysis | Build simple script: group read() calls by file path, flag 2nd+ full reads of same file |

## Connection to Prior Work

- **EXP-700** (killed): targeted parallel calls — structural efficiency. EXP-850 targets *redundant* calls instead.
- **Context-window efficiency** priority item from tracker: this is the direct experiment for it.
- If positive, combine with EXP-700's batching insight for compound efficiency gains.

## Next Steps

1. ✅ Design experiment (this document)
2. ✅ Build measurement script (`EXP-850-measure-redundant-reads.ts` — validated with demo data)
3. Run Phase 0 baseline (5 trials on multi-file-refactor)
4. Create treatment scenario with skill injection
5. Run Phase 1 treatment (5 trials)
6. Write results, decide promote/reject
