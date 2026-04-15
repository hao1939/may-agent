## Patch: Add git-add-agents warning to common-sense.md

### Target file: agents/shared/common-sense.md
### Location: After the existing "- git: AVAILABLE" line

### Add this line after "- git: AVAILABLE":
```
- git add: Files in `agents/` directories are gitignored. Do NOT try to `git add` or `git commit` files under `agents/`. Only `src/` and `scripts/` files are tracked by git. If you need to persist agent files, they already persist at runtime — no git needed.
```

### Rationale
Tech-lead wasted 11 ops (24% of a 46-op session) trying to git add agent workflow files
and then debugging why they weren't being staged. This pattern recurs across 3+ sessions.
A single common-sense line prevents the entire debugging loop.
