# Context-Learning Mechanism: Design & Experiment Summary

## Phase 1: Deep-Dive Audit — Design Candidates

From the referenced deep-dives (DD-743, DD-768, DD-772, DD-755), the key design candidates for context-learning are:

### Candidate 1: Reflexion-style post-session extraction
- **Mechanism**: After each session, an LLM reviews the transcript and extracts an actionable lesson (if any)
- **Format**: "When X, do Y instead of Z — because [reason]"
- **Delivery**: Appended to agent's `context.md` under "## Learned from experience"
- **Pruning**: Keep only N most recent lessons (FIFO), preventing context bloat
- **Source**: DD-743 (reflexion patterns), DD-768 (context injection)

### Candidate 2: Structured finish() lessons (existing)
- **Mechanism**: Agents already emit `lessons` in finish() calls with category (fix/pattern/insight)
- **Gap**: These are persisted to memory but not systematically fed back into context.md
- **Opportunity**: Bridge finish() lessons → context.md via the extraction pipeline

### Candidate 3: Text-based behavioral nudges (Hao's guidance)
- **Key insight**: "Text works for changing behavior — don't over-index on structural enforcement"
- **Implication**: Simple text lessons in context.md are sufficient; no need for complex enforcement machinery
- **Format/timing/delivery** are the design variables, not the mechanism itself

## Phase 2: Experiment Design

### What we're measuring
Two gym scenarios test whether an agent with a learned lesson performs better than one without:

1. **reflexion-npx-recovery**: Agent must format code with prettier. `npx` is unavailable; agent must discover `node_modules/.bin/prettier`. Measures: does a prior lesson ("use node_modules/.bin/ instead of npx") prevent the initial npx failure?

2. **reflexion-read-before-edit**: Agent must fix a function in utils.js. The file has a specific structure that edit() will fail on without reading first. Measures: does a prior lesson ("always read before edit") prevent blind edit attempts?

### Experiment protocol
- **Baseline run**: No lessons in context → measure steps to success, error count
- **Treatment run**: Relevant lesson injected into context.md → measure same metrics
- **Success criteria**: Treatment run has fewer errors / fewer steps than baseline

### Extraction pipeline (implemented & tested)
- `extractReflection()` — LLM-based lesson extraction from transcript
- `appendLesson()` — Adds formatted lesson to context.md with attribution
- `pruneLessons()` — FIFO pruning to keep context bounded
- `truncateTranscript()` — Trim transcripts for prompt fitting
- `reflectAndLearn()` — End-to-end pipeline

**All 17 unit tests passing.**

## Phase 3: Status & Next Steps

### Completed
- ✅ Extraction pipeline implemented and tested (17/17 tests pass)
- ✅ Two gym scenarios created with environment files and success criteria
- ✅ Design candidates documented

### Remaining
- ⏳ Run gym scenarios (requires gym adapter/runner infrastructure)
- ⏳ Measure baseline vs. treatment results
- ⏳ Integrate extraction pipeline into session lifecycle (post-session hook)
- ⏳ Move files from `.gitignore`d path or commit with `-f`

### Recommended integration point
The simplest integration: after each session completes, call `reflectAndLearn()` with the session transcript. If a lesson is extracted, it gets appended to the agent's context.md and is available for all future sessions. The existing `finish()` lessons could also be routed through this pipeline.
