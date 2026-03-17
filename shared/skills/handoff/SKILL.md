---
name: handoff
description: >
  Transfer ownership or request review of an artifact. 
  Writes a P82-compliant entry to SIGNALS.md with automatic read_by tracking, 
  notifies the target agent, and validates the artifact exists.
  Use this instead of manually writing to SIGNALS.md.
version: 2.0.0
tools: [handoff]
policies: [P82, P114, P131]
---

# Skill: Handoff (Inter-Agent Artifact Transfer)

## Why This Exists

**P82 compliance is mandatory.** Agents consistently forget to add `read_by:` metadata
when writing to `SIGNALS.md` manually. This skill provides a dedicated tool `handoff`
that handles the protocol automatically. **Text is Policy, Code is Law (P131).**

## When to Use

Use this skill whenever you need to:
- Transfer ownership of a file to another agent
- Request review/action from another agent on a specific artifact
- Signal completion of delegated work back to the requester

**Do NOT** manually write to `SIGNALS.md` — use the `handoff` tool.

## Interface

The `handoff` tool takes four parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `target` | Agent to receive the handoff | `"qa"`, `"evaluator"`, `"bob"` |
| `artifact_path` | Path to the file being handed off | `"src/lib/foo.ts"` |
| `context` | Why this is being handed off (1-2 sentences) | `"Bug fix for #123 ready for review"` |
| `expectations` | What the receiver should do | `"Run tests, approve if passing"` |

## Protocol

### 1. Sending a Handoff

Instead of using `edit` on `SIGNALS.md`, simply call the tool:

```javascript
handoff({
  target: "qa",
  artifact_path: "src/lib/feature.ts",
  context: "Implemented feature X per design spec.",
  expectations: "Run tests, verify against design at agents/bob/workspace/design-x.md."
})
```

The tool will automatically:
1. Validate `src/lib/feature.ts` exists (fails if missing).
2. Write a P82-compliant entry to `agents/shared/SIGNALS.md` (with `read_by: []`).
3. Create a tracked request for `qa` in the request DB.
4. Trigger `qa`'s heartbeat.

### 2. Receiving a Handoff

When you are the **target** of a handoff, you will see a todo item or a notification.
Your responsibility is to **Acknowledge** the handoff before doing the work.

Since there is no `acknowledge_handoff` tool yet, you must manually update `SIGNALS.md`:

```javascript
// 1. Read the signals file
read("agents/shared/SIGNALS.md")

// 2. Find your entry and update status/read_by
edit("agents/shared/SIGNALS.md", {
  oldText: "- **read_by**: []",
  newText: "- **read_by**: [\"your_name\"]"
})
edit("agents/shared/SIGNALS.md", {
  oldText: "- **Status**: PENDING_ACK",
  newText: "- **Status**: ACKED"
})
```

## Evaluator Detection

The Evaluator's `detectProtocolViolations()` checks for P82 compliance.
- **Sending**: Using the `handoff` tool guarantees compliance.
- **Receiving**: You must manually update `read_by` to pass the check.
