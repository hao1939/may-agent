---
name: handoff
description: >
  ⚠️ DEPRECATED — Use `agents.message(target, message)` instead.
  SIGNALS.md has been replaced by the request database.
version: 3.0.0
tools: []
policies: [P82]
deprecated: true
---

# Skill: Handoff — ⚠️ DEPRECATED

**This skill is deprecated.** SIGNALS.md has been replaced by the request tracking database and `agents.message()`.

## Migration

Instead of using the old `handoff` tool:

```javascript
// OLD (deprecated):
handoff({ target: "qa", artifact_path: "src/lib/foo.ts", ... })

// NEW (use this instead):
write("agents/your-name/workspace/brief-foo.md", content)
agents.message("qa", "Review ready: agents/your-name/workspace/brief-foo.md")
```

The request database automatically tracks all `agents.message()` calls with from/to/task metadata.

## Why Deprecated

1. `SIGNALS.md` was a coordination bottleneck — single file, race conditions
2. Request DB provides durable tracking with query support
3. `agents.message()` is simpler and already works
