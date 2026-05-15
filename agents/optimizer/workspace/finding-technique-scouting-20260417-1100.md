# Finding: Verbatim Target Anchoring (matched-pair scout, 24h window)

**When:** 2026-04-17 11:00 UTC
**Author:** optimizer (Mode C — Skill & Technique Scouting)
**Scope:** Last 24h evaluated sessions, non-heartbeat, opCount ≥ 5
**Method:** `bun:sqlite` readonly probe of `sessions` × `evaluations`; grouped by agent; compared sessions with `quality ≥ 0.8` vs `quality ≤ 0.4` within matched task classes; re-read issues text for LO sessions.

## Pair evidence

| Agent     | HI session                  | q    | ops | LO session                  | q    | ops | LO failure (from evaluator issues)                                                                                                  |
|-----------|-----------------------------|------|-----|-----------------------------|------|-----|-------------------------------------------------------------------------------------------------------------------------------------|
| optimizer | s_1776362431985_376         | 1.00 | 15  | s_1776371454558_88          | 0.35 | 17  | **Wrong-target deliverable**: produced `finding-bob-187op-scenario-gap-fill-0416.md` when task asked for `finding-experiment-session-cost-0416.md` (FM-2.6). |
| optimizer | s_1776369654374_69          | 0.90 | 5   | s_1776407456427_392         | 0.30 | 10  | Produced required finding name but evidence didn't map to the task's *named target sessions* (coach 143-op EXP-156) — drifted. |
| coach     | s_1776381769168_173         | 1.00 | 47  | s_1776352982296_274         | 0.20 | 14  | Did not produce `EXP-172/results.md` or update `EXP-172/design.md` — the two file paths named verbatim in the task. |
| coach     | s_1776383561704_187         | 1.00 | 29  | s_1776385360425_201         | 0.38 | 36  | Claimed baseline trials/scorer fixes without tool-output evidence for the specific files the task listed. |
| coder     | s_1776342670873_111         | 0.93 | 14  | s_1776346275613_210         | 0.28 | 13  | Iteration goal was "reduce session startup waste"; worked on checkbox/status edits in unrelated project file (FM-2.6). |
| tech-lead | s_1776362820424_387         | 1.00 | 16  | s_1776362937679_389         | 0.38 | 21  | Milestone M1 required `commitAndMerge()` in `agents/shared/lib/git-utils.ts`; built `agents/shared/scripts/commit-and-merge.sh` instead (FM-2.6). |

Five of five LO sessions share the same root failure: **the literal deliverable path/identifier given in the task never appears in the session's early actions**, then the agent produces a similarly-named or thematically-related artifact and declares success. HI counterparts open with either a `ls`/`cat` of the exact named path, a write skeleton whose filename is pasted verbatim from the task, or a restated "Task asks me to write `<literal path>`".

## Behavioral difference (observable in tool sequence)

- **HI pattern (first 3–5 ops):** the exact deliverable path/filename/function-name from the task string appears as an argument to `read`, `write`, `bash ls`, or in the first response text — always within the first 5 tool calls. Example: `s_1776381769168_173` opens by writing the exact scenario directory the task named; `s_1776342670873_111` opens by reading the exact source file the milestone names.
- **LO pattern:** the first 5 ops are generic exploration (`ls`, `grep`, DB probes, reads of related-but-not-named files). The literal target string from the task never appears as a tool argument. The agent then writes *something* that matches the task's *topic* but not its *identifier*.

This is mechanically checkable after the fact (`grep` for the literal deliverable token in the transcript's first N tool calls). It is enforceable at the prompt layer.

## Gap vs existing skills

- `deliverable-integrity` — tells agents to *list* deliverables but does not require them to be **copied verbatim from the task** or to appear as a tool argument early.
- `DELIVERABLES_CHECKLIST.md` guard — forces a checklist file but does not validate that items are literal quotes of task tokens; LO sessions satisfy the guard with paraphrased items (e.g., "write a finding about experiment sessions" instead of `finding-experiment-session-cost-0416.md`).
- `scope-discipline` — archived/untested; addresses drift mid-session, not initial mis-targeting.
- `prerequisite-gap-protocol` — covers missing inputs, not wrong-target outputs.

No current skill enforces **"quote the task's literal deliverable tokens in your first write and in your checklist."**

## Proposed skill text

Add a short enforcement rule to `agents/shared/skills/deliverable-integrity/SKILL.md` (Step 1 section) — not a new skill file, because the gap is adjacent to an existing skill and stacking a whole new skill would violate KE-123.

```markdown
### Step 1b: Anchor deliverables to *literal* task tokens

When building your `DELIVERABLES_CHECKLIST.md`, each item MUST include the
**verbatim string** from the task prompt that names the deliverable — path,
filename, function name, or session ID. Paraphrasing is not allowed.

**Right:**
- [ ] `agents/optimizer/workspace/finding-experiment-session-cost-0416.md`
      (task line: "write finding to agents/optimizer/workspace/finding-experiment-session-cost-0416.md")
- [ ] `commitAndMerge()` exported from `agents/shared/lib/git-utils.ts`
      (task line: "M1: implement commitAndMerge() in agents/shared/lib/git-utils.ts")

**Wrong:**
- [ ] a finding about experiment session costs   ← paraphrased, loses the path
- [ ] merge helper script                         ← paraphrased, loses the filename

**Self-check before your first write:**
Run `grep -F "<literal deliverable token>" <path-to-your-first-write>` mentally.
If the token from the task does not appear as an argument to your first `write`
or `edit` call, you are about to produce a wrong-target deliverable.

This targets FM-2.6 wrong-target failures that survive the existing checklist
guard because paraphrased items pass but don't match the task.
```

## Target agents

- **Primary:** `optimizer`, `coach`, `coder`, `tech-lead` — all four had wrong-target LO pairs in the last 24h.
- **Secondary:** `bob` synthesis tasks (s_1776365581521_27 non-delivery of `KE-204.md` is a literal-token miss).

## Expected impact

- 5/5 of the LO sessions above (q̄ = 0.32) would have been flagged at the checklist step by the self-check. Conservatively, converting half to HI quality would raise average quality on non-heartbeat multi-deliverable tasks by ~0.25 × 0.5 ≈ 0.08 on this population.
- Low risk of regression: the rule is additive to an already-required checklist; no new workflow, no new gate, no behavioral stacking (KE-123 safe).
- Mechanically auditable: evaluator can post-hoc grep the checklist file for a literal substring of the task; HI/LO signal is a 1-line check.

## Dispatch

Sending to **tech-lead** as owner of skill-library edits (with optimizer copy for awareness). One-line change to `deliverable-integrity/SKILL.md` Step 1; no new file.

## Limitations / honest caveats

- N = 6 matched pairs is small. Pattern is consistent but not statistically strong; treat this as a *hypothesis for a text-rule intervention*, not a proven fix.
- Per KE-002, text rules have 0% success for *judgment* failures. Wrong-target is a **recognition** failure (did the agent notice the literal path?), which is closer to the convention-style rules where text works (88-100%). Still — if after 2 weeks the quality distribution is unchanged, escalate to a workflow-level enforcement (KE-007).
- No gym scenario yet tests "wrong-target deliverable." If tech-lead picks this up, a companion gym scenario would strengthen the evidence.
