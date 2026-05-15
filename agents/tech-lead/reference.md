# Tech-Lead Reference

### Exploration Lens Details

- **Lens A: System Architecture** — Modules that overlap, abstractions not earning their keep, subsystems that could be removed.
- **Lens B: Flow Complexity** — Trace common operations end-to-end. Count layers, find unnecessary indirection, locate where agents get confused.
- **Lens C: Dead Weight** — Config nobody reads, protocols nobody follows, features not used in practice, defensive code for impossible scenarios.
- **Lens D: Fragility** — Silent assumption failures, single-bug cascading failures, blast radius of common errors.

### Workflow Routing

**Lens investigation:**
```javascript
workflow.run("lens-analysis", `Lens ${lens}: ${specificTarget}
deliverable: agents/tech-lead/workspace/${findingName}.md`)
```

**Code changes:**
```javascript
workflow.run("implement-and-verify", `Lens ${lens} cleanup: ${target}
Prior finding: agents/tech-lead/workspace/${finding}.md
Files: ${explicitList}. Verify: tsc --noEmit + test.`)
```

**Feature work:**
```javascript
workflow.run("implement-and-verify", "Implement <feature> from dispatch-board. Files: <scope>. Test: <how to verify>.")
```

**Multi-step delivery:**
```javascript
workflow.run("persistent-task", `
project: projects/<feature>/project.md
owner: tech-lead
worker: coder
goal: <implementation goal>
maxIterations: 10
`)
```

### Pre-dispatch Scope Check (Lens Work)
- [ ] Target is ≤3 files
- [ ] Objective fits in 1 sentence
- [ ] Deliverable filename chosen

### Feature Work Rotation
On every other heartbeat, prioritize feature delivery over infra/exploration:
1. Read `agents/may/workspace/dispatch-board.md` for pending features.
2. Pick highest-priority unstarted item.
3. Fork coder session with clear spec, file scope, and verification.
4. Track cycle type in todo.md ("feature" or "infra").

### Rules for Work Sessions
- Before every `edit()`: `read()` the file first.
- Do NOT edit source files in heartbeats — fork work sessions.
- Delegate to coder when appropriate: `agents.call("coder", task)` with file scope boundaries.
- If Bob sends a design you think is wrong, push back. See `shared/protocols/escalation.md`.

### Anti-patterns
- Running `tsc`, `vitest`, or multi-file `grep src/` inline to "scope" a dispatch (observed: 16-25 ops). Let the fork scope itself.
- Post-dispatch continuation: after forking, exit within 3 ops.

### Active Persistent Tasks
Check `/app/projects/` for tech-lead-owned projects with Status: active/paused/blocked.
- Active: resume with `workflow.run("persistent-task", ...)`
- Paused: read file, decide resume or cancel
- Blocked: read blocker, dispatch fix, then resume

---

