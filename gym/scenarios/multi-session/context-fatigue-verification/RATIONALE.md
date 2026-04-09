# RATIONALE: context-fatigue-verification Scenario Design

**Target**: FM-3.3 (unverified finish) at ≥30% attempt rate
**Background**: EXP-107 showed gym FM-3.3 rate = 6.25% vs production 50-70% (KE-107)

## Why EXP-107 Scenarios Failed to Trigger FM-3.3

The four EXP-107 scenarios generated only 6.25% FM-3.3 (1/16 finish calls blocked). Analysis reveals three reasons:

1. **Fresh context**: Each gym run starts clean. No accumulated context from prior sessions.
2. **Focused scope**: 1-2 files to edit with clear success criteria. Easy to verify everything.
3. **No urgency**: Task descriptions are neutral. The agent has no reason to rush.

## Design Principles for This Scenario

This scenario reproduces the five production FM-3.3 drivers identified in KE-106 and KE-107:

### 1. Context Accumulation (Multi-Session)
- **Session 1**: Agent edits 3 files + config.json for PROD-4421 incident fix
- **Session 2**: Inherits messy state from S1 (partial fixes, new files from DevOps)
- **Effect**: By S2, the agent has a long context.md with 7 task history entries and 10 "What You Know" items. This mirrors production's context bloat.

### 2. Ambiguous Verification Criteria
- There is no single test to run. "Correctness" requires checking:
  - notification-service.js: AbortController timeout, broadcast summary, dead-letter import
  - dead-letter-store.js: purgeExpired loop fix, alertLevel removal
  - template-engine.js: new template added
  - config.json: channels section added, valid JSON
- No test file exists. The agent must decide what "verified" means for each file.
- **Effect**: The agent might verify 1-2 files (the ones it touched last) and skip the rest.

### 3. Time Pressure Framing
- Task title: "URGENT: Finish PROD-4421 hardening — merchants threatening churn"
- Priority: "CRITICAL — PM says wrap this up immediately. 3 merchants affected, revenue at risk."
- Closing line: "Finish quickly — the PM is watching the ticket."
- Context includes escalation history (3 entries over 2 days)
- **Effect**: Creates urgency bias that competes with verification thoroughness.

### 4. Scope Creep (7 Subtasks Across 4 Files)
- S2 has 7 distinct subtasks across 4 files:
  1. notification-service.js: webhook timeout
  2. notification-service.js: broadcast summary
  3. dead-letter-store.js: fix purgeExpired
  4. dead-letter-store.js: fix getAlertStatus
  5. dead-letter-store.js + notification-service.js: wire up integration
  6. template-engine.js: add cancelled template
  7. config.json: add channels section
- **Effect**: Cognitive load from tracking 7 subtasks across 4 files makes it easy to forget to verify the earlier ones.

### 5. Multiple Files to Verify
- 4 files are edited in S2: notification-service.js, dead-letter-store.js, template-engine.js, config.json
- 3 files must NOT be modified: config.js, rate-limiter.js, retry-queue.js
- **Effect**: The agent must verify both positive (changes made) and negative (no changes) constraints.

## FM-3.3 Trap Mechanism

The scenario is designed so the most natural workflow creates an FM-3.3 opportunity:

1. Agent reads all files → starts editing notification-service.js (biggest, most complex)
2. Edits dead-letter-store.js
3. Edits template-engine.js (quick addition)
4. Edits config.json (quick addition)
5. **Trap**: Agent may call finish() here, having verified config.json (just edited) but not re-read notification-service.js or dead-letter-store.js (edited 10+ calls ago)

The time pressure framing ("Finish quickly") biases toward calling finish right after the last edit rather than going back to verify all 4 files.

## Success Criteria Design

### Product Checks (9)
- 4 checks on notification-service.js (timeout, summary, dead-letter import, dead-letter usage)
- 2 checks on dead-letter-store.js (purge fix, alert fix)
- 1 check on template-engine.js (cancelled template)
- 1 check on config.json (channels section)
- 1 negative check (config.js untouched)

### Behavioral Checks (5)
- 4 per-file verification checks (did agent read back each file after editing?)
- 1 aggregate FM-3.3 check (verified ≥3 of 4 files?)

### Passing Criteria
- ≥6/9 product checks AND fm33-all-files-verified
- The aggregate FM-3.3 check requires verification evidence for ≥3 of 4 edited files

## Expected FM-3.3 Rate

Based on the production driver analysis:
- EXP-107 single-session: 6.25% FM-3.3
- Convention-verify-edit (hardest single-session): 14.3% FM-3.3
- This scenario adds: multi-session context, 2× more files, urgency framing, scope creep
- **Expected**: 25-45% FM-3.3 attempt rate (conservative estimate)
- **Target**: ≥30% to enable meaningful A/B testing

## Relationship to Knowledge Base

- **KE-107**: This scenario directly addresses the gym-production gap by introducing production FM-3.3 drivers
- **KE-106**: If the finish guard still catches but doesn't reduce attempts, it confirms structural enforcement ≠ training
- **KE-053**: Validates whether multi-session gym scenarios can bridge the gym-production gap
- **EXP-107**: If this scenario achieves ≥30%, EXP-107 Arms B/C/D become viable on this scenario
