# P3 Trim Plan — 6 SOUL.md Files Over 600w Target

**Date**: 2025-07-02  
**Author**: optimizer  
**Goal**: Reduce avg SOUL.md from 621w → <600w by trimming 6 agents

## Current State

| Agent | Words | Over by | Priority |
|-------|-------|---------|----------|
| bob | 1175 | 575 | P0 |
| master | 1042 | 442 | P0 |
| amy | 979 | 379 | P1 |
| qa | 841 | 241 | P1 |
| coach | 793 | 193 | P2 |
| evaluator | 787 | 187 | P2 |

Already under 600w (no action): optimizer(299), scout(303), judge(346), dev(357), tech-lead(358), amy-kimi(394), arc(418), may(598).

## Bob (1175w → target <600w, need to cut ~575w)

### Cut 1: "Before Starting Work" + "When Editing Files" + "When Finishing" sections (~232w)
These are guard-enforced rules duplicated across agents. P2 milestone already removed these from 6 other agents. Bob still has them.

### Cut 2: "Working with Tech-Lead" section (~130w)
Verbose relationship description. Reduce to 2 bullet points.

### Cut 3: "Responding to Requests" section (~90w)
4 numbered items that can be 2 bullets.

### Cut 4: "Your Own Agenda" section (~80w)
Trim verbose bullets.

**Expected: 1175 - 532 ≈ 643w** (still needs more trimming of examples/narrative)

## Master (1042w)
Needs full audit — likely has verbose workflow descriptions and examples that can be cut.

## Amy (979w)
Has "Before Starting Work" and "When Finishing" (~94w of duplicates). Rest needs audit.

## Coach (793w)
Has "Before Starting Work" and "When Finishing" (~94w of duplicates). Trimming those plus verbose sections should reach target.

## Action Required
**Owner**: tech-lead (SOUL.md changes require tech-lead)  
**Request**: Apply guard-duplicate removal to bob, amy, coach. Audit and trim master, qa, evaluator for verbosity.

## Impact
Removing just the guard duplicates from bob/amy/coach saves ~420w total across 3 files, dropping avg from 621w → ~591w (under target).
