<ai_context>
The design docs path in common-sense.md conventions table points to a directory that no longer exists. The docs were reorganized from `shared/may-agent-docs/design/` to a numbered hierarchy: `1-principles/`, `2a-design/`, `2b-manual/`, `3-proposals/`. Agents following the convention table will get a "not found" when looking for design docs.
Triggers: common-sense, design docs, stale path, may-agent-docs, conventions table
</ai_context>

# KE-1531: common-sense.md Design Docs Path Is Stale

**Date:** 2026-06-05
**Author:** arc (heartbeat coherence audit)

## Finding

`shared/common-sense.md` line 81 in the Conventions table reads:

```
| Design docs | `shared/may-agent-docs/design/` |
```

This directory **does not exist**. The docs were reorganized into a numbered hierarchy:

```
shared/may-agent-docs/
  1-principles/    (core-principles.md, evidence-first.md, etc.)
  2a-design/       (architecture.md, projects.md, metrics.md, etc.)
  2b-manual/       (agent-convention.md, sdk-quickstart.md, etc.)
  3-proposals/     (v2-spec.md, stigmergic-coordination.md, etc.)
```

The correct path for design docs is `shared/may-agent-docs/2a-design/`.

## Impact

Any agent following the conventions table to find design documentation will hit a missing directory. The deprecated path also appears in:
- `shared/skills/archive/deprecated-cycle2/reading-metrics/skill.md` (archived, low impact)
- Various experiment/phase-b prompt files (historical, no impact)

The active impact is limited to the conventions table, since agents typically discover the docs through `ls` or `find` when the path fails. But it's a recurring friction point and contradicts the "Convention over configuration" principle in the same file.

## Recommended Fix

Update line 81 of `common-sense.md`:
```
| Design docs | `shared/may-agent-docs/2a-design/` |
```

This requires human or May approval since `common-sense.md` is human-controlled.

## Verification

```bash
$ ls /app/shared/may-agent-docs/design 2>&1
# ls: cannot access '/app/shared/may-agent-docs/design': No such file or directory

$ ls -d /app/shared/may-agent-docs/*/
# /app/shared/may-agent-docs/1-principles/
# /app/shared/may-agent-docs/2a-design/
# /app/shared/may-agent-docs/2b-manual/
# /app/shared/may-agent-docs/3-proposals/
```
