# Context-Learning Integration Design

**Status**: Ready for implementation  
**Date**: 2026-04-19  
**Addresses**: Hao's question — "what's the right format, timing, and delivery mechanism for learned lessons?"

## Design Decision: Text-Based Lessons in context.md

Per Hao's guidance: text works for changing behavior. No structural enforcement needed.

### Format
```
## Learned from experience
- When X, do Y instead of Z — because [reason] (source: session_id, date)
```

**Why this format:**
- Actionable instruction ("When X, do Y") — not a vague observation
- Includes root cause ("because...") — agent understands *why*
- Attribution (source, date) — enables pruning and debugging
- Bullet list — scannable, no parsing needed

### Timing: Post-Session Extraction

**When**: After every session that completes with `status: failure` or has `errors_encountered`.  
**Skip**: Clean sessions (`status: success`, no errors) — don't extract from what went well.

**Why post-session, not real-time:**
- Agent already has finish() lessons — but these are self-reported and often generic
- Post-session LLM review catches patterns the agent missed in the moment
- No runtime overhead — extraction happens asynchronously after session ends

### Delivery: Append to context.md → Available Next Session

**Pipeline:**
1. Session ends → transcript + outcome saved
2. `extractReflection()` reviews transcript, produces lesson or NO_LESSON
3. If lesson: `appendLesson()` adds to `agents/{name}/context.md`
4. `pruneLessons()` keeps max 15 lessons (FIFO)
5. Next session loads context.md as usual — lesson is automatically included

**Why context.md (not a separate file):**
- Already loaded by every session — zero integration cost
- Sits alongside other behavioral guidance — natural reading context
- Human-editable — operators can curate lessons

### Pruning: 15 Lessons Max, FIFO

- 15 lessons ≈ 500-750 tokens — negligible context cost
- FIFO removes oldest first — recent lessons are more relevant
- Future: could add relevance-based pruning (match lesson topics to task type)

## Integration Points

### Where to hook in (simplest path)

The session lifecycle already calls `finish()`. The extraction should happen in the **session completion handler** — wherever the transcript is persisted today.

```
// Pseudocode for integration
async function onSessionComplete(session) {
  if (session.status === 'success' && !session.errors?.length) return;
  
  const { lesson, persisted } = await reflectAndLearn({
    agentName: session.agent,
    transcript: session.transcript,
    outcome: `${session.status}: ${session.summary}`,
    sessionId: session.id,
    llmCall: cheapModelCall,  // Use fast/cheap model for extraction
    fs: realFs,
    contextDir: 'agents',
  });
  
  if (persisted) {
    await pruneLessons({
      contextPath: `agents/${session.agent}/context.md`,
      maxLessons: 15,
      fs: realFs,
    });
  }
}
```

### Cost considerations
- Use a cheap/fast model for extraction (not the main agent model)
- Only extract from sessions with errors — ~30-50% of sessions
- Each extraction is 1 LLM call with ~2K tokens input

## Validation Plan

### Gym scenarios (created, ready to run)
1. **reflexion-npx-recovery** — baseline: agent tries npx, fails, recovers. Treatment: lesson says use node_modules/.bin/ → agent skips npx entirely.
2. **reflexion-read-before-edit** — baseline: agent edits blindly, fails, re-reads. Treatment: lesson says read first → agent reads before editing.

### Success metric
Treatment run has **fewer tool calls** and **zero avoidable errors** compared to baseline.

### Running the experiment
```bash
# When gym runner is available:
cd /app/agents
test/gym/run-gym.sh reflexion-npx-recovery --agent coder
test/gym/run-gym.sh reflexion-read-before-edit --agent coder
```

## What's Built (all tested, 17/17 passing)

| Module | Function | Status |
|--------|----------|--------|
| extract-reflection.js | `extractReflection()` | ✅ Tested |
| extract-reflection.js | `appendLesson()` | ✅ Tested |
| extract-reflection.js | `pruneLessons()` | ✅ Tested |
| extract-reflection.js | `truncateTranscript()` | ✅ Tested |
| extract-reflection.js | `reflectAndLearn()` | ✅ Tested |
| gym scenarios | reflexion-npx-recovery | ✅ Created, criteria validated |
| gym scenarios | reflexion-read-before-edit | ✅ Created, criteria validated |
