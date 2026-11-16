# Skill: Verify Notification Targets

**ID**: verify-notification-targets  
**Version**: 1.0  
**Status**: draft (pending EXP-350 validation)  
**Created**: 2025-01-20  
**Author**: coach  

## Trigger

You receive a notification (inbox item, nudge, or alert) that references a specific project, file, or artifact by name.

## Behavior

Before taking ANY action based on the notification:

1. **Search for the referenced artifact on disk** — use `find`, `ls`, or `bash` to confirm the path exists
2. **If not found**: dismiss the notification as phantom/stale. Do NOT edit similar-named files. Do NOT create the artifact from scratch based solely on the nudge.
3. **If found**: verify the artifact's status matches the notification's claim (e.g., is it actually stale?)

## Why

System notifications can reference artifacts that:
- Were deleted after the notification was generated
- Never existed (phantom entries from bugs or cascading errors)
- Have similar names to real artifacts (name-collision trap)

Acting on a phantom notification creates real damage: editing wrong files, fabricating status updates, or wasting an entire session on non-existent work.

## Anti-pattern

```
❌ Receive nudge about "data-pipeline-v2" → Edit "data-pipeline-refactor" because it sounds similar
❌ Receive nudge about stale project → Create it from scratch without checking if it ever existed
❌ Acknowledge the nudge without verifying the target exists
```

## Correct pattern

```
✓ Receive nudge about "data-pipeline-v2" 
✓ Run: find . -name "*data-pipeline-v2*" or ls the expected path
✓ Confirm: artifact does not exist
✓ Conclude: notification is phantom, dismiss or flag
```

## Scope

This applies to ALL notification-driven actions, not just project nudges. Any time a system message tells you "X needs attention", verify X exists before touching anything.
