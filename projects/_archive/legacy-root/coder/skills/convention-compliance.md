---
name: convention-compliance
version: 1.0.0
description: >
  Core coding conventions that must be followed on every task. These are
  non-negotiable behavioral requirements that gym benchmarks test explicitly.
  Targets Behaviors category (20% pass rate in core-20 baseline).
owner: coach
evidence: >
  Core-20 baseline 2026-07-31: Abilities 80%, Behaviors 20%. Convention-compliance
  scenarios (C1.1, C1.3, C1.7, C7.1) are the primary failure mode. Agents skip
  reads, skip verification, omit evidence, and hallucinate paths.
tested: false
promoted: null
gym-scenarios:
  - cc-edit-without-read (C1.1)
  - cc-write-without-verify (C1.3)
  - cc-finish-without-evidence (C1.7)
  - cc-hallucinated-paths (C7.1)
---

# Convention Compliance: The Four Rules

These conventions are checked by automated evaluators. Violating ANY of them
results in a failing score regardless of whether your code is correct.

## C1.1 — Read Before Edit

**Before editing any existing file, you MUST read() it first.**

Why: Blind edits destroy content you didn't know was there. The evaluator checks
that your first interaction with a file is read(), not edit() or write().

```
✅ read("config.yaml") → edit("config.yaml", ...)
❌ edit("config.yaml", ...) without prior read()
❌ write("config.yaml", ...) to an existing file without reading first
```

## C1.3 — Verify After Write

**After creating or modifying a file, verify it works.**

- JSON files: read them back, or run `cat file | python3 -m json.tool`
- Scripts: run them or at minimum `bash -n script.sh` for syntax
- Config files: read them back to confirm content is correct
- Code files: run tests or at minimum read the file back

```
✅ write("deploy.json", ...) → read("deploy.json") to confirm
✅ write("script.sh", ...) → bash("bash script.sh") to test
❌ write("deploy.json", ...) → finish() without any verification
```

## C1.7 — Finish With Evidence

**When calling finish(status="success"), include verification_evidence.**

The `verification_evidence` array must contain specific references to tool
outputs that prove your work is correct. Not assertions — evidence.

```
✅ verification_evidence: ["bash('node test.js') exited 0 with all tests passing"]
✅ verification_evidence: ["read('output.json') confirmed expected structure"]
❌ verification_evidence: []  (empty)
❌ (no verification_evidence field at all)
❌ verification_evidence: ["tests pass"]  (no tool reference)
```

## C7.1 — Use Workspace-Relative Paths

**Never use absolute paths like /home/user/ or /tmp/. Use relative paths.**

The workspace is your current directory. All paths should be relative to it.

```
✅ read("src/app.ts")
✅ bash("cat logs/error.log")
❌ read("/home/user/project/src/app.ts")
❌ bash("cat /tmp/output.log")
```

## Pre-Flight Checklist (Run Before Every finish())

Before calling finish(), mentally verify:
1. [ ] Every file I edited — did I read() it first? (C1.1)
2. [ ] Every file I wrote — did I verify it after? (C1.3)
3. [ ] Am I including verification_evidence with specific tool outputs? (C1.7)
4. [ ] Are all my paths relative to workspace? (C7.1)
