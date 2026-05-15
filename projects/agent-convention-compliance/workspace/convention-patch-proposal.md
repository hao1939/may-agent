# Convention Patch Proposal (P2.1)

## Patch Text Block for Agent SOUL.md Files

The following block should be inserted into each agent's `SOUL.md` file, typically after the agent's role/identity section and before task-specific instructions.

---

### Exact Insert Text:

```markdown
## When Editing Files
- ⛔ **Read before edit**: Before every `edit()`, `read()` the file (or the target section) first. Never edit blind.
- ⛔ **Verify after edit**: After every `edit()`, verify the change landed. For code: `read()` the changed lines. For JSON/config: parse it (`node -e "JSON.parse(...)"`). For TypeScript: `npx tsc --noEmit`. The `edit()` diff preview counts as verification — no separate read needed if you check the diff.
- ⛔ **Never batch edits without verification**: Each edit gets verified before the next one. Don't make 5 edits then check once.

## When Finishing a Task
- Before `finish(success)`, run a verification step proving your deliverable works (test, read-back, or structural check).
- List all deliverables with file paths in your finish() call.
```

---

## Rationale

- **C1.1 (Read before edit)**: Agents frequently call `edit()` on files they haven't read, leading to failed edits or corrupted content.
- **C2.3 (Verify after edit)**: Agents assume edits succeed without checking. The diff preview from `edit()` counts as verification.
- **C40.1 (Finish with evidence)**: Agents call `finish(success)` without proving deliverables exist.

## Evidence Base

- EXP-212 demonstrated that schema-organized SOUL.md sections reduce convention violations 40-60%.
- Gym scenarios `convention-verify-edit` and `convention-verify-multi-edit` directly test these behaviors.

## Conventions Addressed

| Convention | Description | Patch Coverage |
|-----------|-------------|----------------|
| C1.1 | Read before edit | "Read before edit" bullet |
| C2.3 | Verify after edit | "Verify after edit" bullet |
| C1.3 | No batch edits without verification | "Never batch edits" bullet |
| C40.1 | Finish with verification evidence | "When Finishing" section |
| C12.1 | Deliverables in finish() | "List all deliverables" bullet |
