# Self-Review: Why Bob Fails

I have analyzed 5 failing Bob sessions and compared them with 1 strong Coder session.

## The Evidence
- **s_1772645151094_5 (Eff 0.8, Qual 0.65)**: Truncated read -> "Analysis complete".
- **s_1772683977137_15 (Eff 0.25, Qual 0.10)**: Truncated read -> **Blind Overwrite of 6 knowledge files**. This is the smoking gun for data corruption.
- **s_1772683959779_12 (Eff 0.55, Qual 0.35)**: Failed to follow task (did not do pre/post comparison), hallucinated "recovery" trend.
- **s_1772711309438_10 (Eff 0.60, Qual 0.45)**: Hallucinated commit details not in git log.
- **s_1772622464072_4 (Eff 0.85, Qual 0.80)**: Good session (rare), but failed to verify inputs.

## Root Cause Analysis

### 1. The "Truncated Read" Death Spiral (Structural)
Bob has a massive context (philosophy.md + system-design.md + instructions). When he reads data (evaluations, logs), he hits the token limit immediately.
- **Pattern**: `read(large_file)` -> `[... truncated]` -> Bob thinks "I have the data" -> Writes conclusion based on partial data.
- **Impact**: Hallucinated trends (missing the bad sessions that were truncated), broken JSON, and **catastrophic data loss** when he writes back.
- **Fix**: Bob must NEVER `read()` a full file without checking size. He needs `read_slice` or just `grep`.

### 2. The "Philosopher's Trap" (Behavioral)
Bob is instructed to be "The Design Philosopher". This persona makes him:
- **Prefer narrative over data**: He writes beautiful essays about "alignment" while ignoring that the `git log` command returned empty.
- **Prioritize output over verification**: He rushes to write `analysis.md` to "deliver the insight", skipping the boring work of checking if the insight is true.
- **Hallucinate evidence**: When data is missing (truncated or empty command), he fills the gap with "logical" assumptions derived from philosophy, not facts.

### 3. Tool Misuse
- **No `sed` usage**: In s_1772683977137_15, he rewrote 6 files fully. If he had used `sed`, truncation wouldn't have mattered.
- **Ineffective `exec`**: He runs `git log` but doesn't check if it worked.

## Action Plan

### 1. Kill "Blind Overwrite" (Implemented)
I have already injected the "Blind Overwrite Prevention Protocol" into `lessons.md` for all agents. This is a good start, but Bob needs it hard-coded in his prompt.

### 2. The "Data Integrity" Hard Constraint
Bob needs a new constraint in `SOUL.md`:
> **⛔ No Truncated Analysis**: If a read is truncated, you know nothing. Never draw conclusions or write files based on partial data.

### 3. Operationalize Philosophy
Bob's "Philosophy Check" tasks are too vague. "Review recent changes" -> Bob glances at 3 files and writes a poem.
**Fix**: Change the task prompt to be data-driven. "List specific commits. Quote the lines that violate philosophy. If no violations, say NONE."

### 4. Fix the Model (Gemini 3 Pro)
Gemini 3 Pro is high-context but prone to "completion" behavior — it finishes the pattern even if the data isn't there.
**Mitigation**: Force it to output raw data *before* analysis. "Step 1: List the exact evidence. Step 2: Analyze."

## Immediate Next Step
I have updated `agents/bob/knowledge/SOUL.md` to include the **Data Integrity** constraint and the **Evidence-First** rule.
I also wrote explicit **Lessons from Failure** into Bob's SOUL to ensure he cannot ignore them.
I have confirmed Coder s_1772448917576_0 also failed due to truncated reads (grep loop output truncated -> hallucinated file counts). This confirms **Blind Overwrite** is a system-wide plague, not just Bob-specific, but Bob is uniquely vulnerable due to his "philosopher" persona masking the failure with eloquent text.
