# Context-Learning Mechanism — Project Complete

## Status: ✅ All 3 Phases Complete

### Phase 1: Audit & Extract (DD-743, DD-768, DD-772, DD-755)
**Deliverable:** `phase1-dd-audit-and-candidates.md`
- Audited 4 deep-dives, extracted 6 design candidates
- Key insight: text-based context injection is simplest and most effective

### Phase 2: Experiment Design  
**Deliverable:** `phase2-experiment-design.md`
- Designed concrete experiment: LLM-based lesson extraction from session transcripts
- Format: "When X, do Y — because Z" (per Hao's guidance on text-based behavior change)

### Phase 3: Implementation & Testing
**Deliverables:**
- `extract-reflection.js` — Core pipeline (extractReflection, appendLesson, pruneLessons, reflectAndLearn)
- `test-extract-reflection.js` — 17/17 unit tests passing
- `demo-e2e.js` — Full E2E demo: 3 sessions → 2 lessons extracted, 1 clean skip
- `integration-design.md` — How to integrate into the agent session lifecycle

### How It Works
1. **Trigger:** After any session with errors or failure status
2. **Extract:** LLM analyzes transcript, produces 1-2 sentence actionable lesson
3. **Filter:** Clean sessions return NO_LESSON (correctly skipped)
4. **Persist:** Lesson appended to `agents/<name>/context.md` under `## Learned from experience`
5. **Prune:** Keeps only N most recent lessons (oldest removed)
6. **Delivery:** context.md is loaded into every future session automatically

### Key Design Decisions
- **Format:** Plain text bullets in context.md (not structured data)
- **Timing:** Post-session reflection (not real-time)
- **Delivery:** Injected via existing context.md loading mechanism
- **Pruning:** FIFO, configurable max (default 10)
- **Attribution:** Each lesson tagged with source session ID and date
