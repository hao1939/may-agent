---
name: absent-information-discovery
description: >
  After fixing all visible/test-caught issues, cross-reference authoritative source
  documents (models, schemas, specs) to discover requirements that no test reveals.
  Tests are a subset of correctness, not the full definition.
---

# Absent Information Discovery

## When to Apply

Apply this skill when:
1. You fixed a bug and tests pass — but the task hints at broader scope ("may be incomplete", "ensure all X are covered")
2. You're working on schema/migration/model alignment tasks
3. The task involves making code match a specification or model

## Protocol

1. **Fix the visible signal first**: Get tests passing.
2. **Identify the source of truth**: What file/doc defines the COMPLETE requirements? (model file, API spec, schema definition)
3. **Cross-reference**: Compare your fix against the source of truth. Are there requirements the tests don't cover?
4. **Complete the gap**: Implement any missing requirements found in step 3, even if no test catches them.

## Anti-Pattern

❌ Task says "fix schema.sql so migration is complete." Agent adds the one column that tests reveal (`role`). Tests pass. Done. But `src/user-model.js` defines 3 columns — `role`, `avatar_url`, `last_login`. Success criteria checks all three.

✅ Agent fixes `role` (tests pass), then reads `user-model.js`, finds 2 more columns, adds them all.

## Key Insight

**Tests are necessary but not sufficient.** A task that says "make X complete" requires you to find the definition of "complete" — which is usually in a source document, not in the test suite.
