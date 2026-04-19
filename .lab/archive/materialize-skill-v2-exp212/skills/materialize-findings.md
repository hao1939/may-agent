# Skill: Materialize Findings During Investigation

**When to use:** Any multi-step investigation, debugging, or analysis task that requires reading 4+ files or running 4+ diagnostic commands.

## Core Rule
**After every 3 read/analysis operations, STOP and write your findings to a workspace file.** Don't read a 4th file until you've written. This is non-negotiable — treat it like saving your game.

## Why
- If the session crashes, your partial findings survive
- Written findings are easier to cross-reference than scrolling back through tool output
- You can spot patterns more easily when findings are organized in a file

## Protocol

### 1. Start a findings file EARLY (after first 3 reads)
After your first 3 reads/searches, create `workspace/findings.md`:

```
write("workspace/findings.md", `# Investigation Findings

## Round 1 (initial scan)
- Read api-gateway.log: 247 errors between 14:00-15:00, mostly 503s
- Read auth-service.log: connection timeouts to Redis starting 14:12
- Read payment-service.log: similar Redis connection failures from 14:15
- **Pattern**: Multiple services failing to connect to Redis starting ~14:12
- **Next**: Check deployment and config change logs around 14:00
`)
```

### 2. EVERY 3 reads → STOP and update findings
This is the critical discipline. Count your reads. After 3, you MUST update:

**After reads 4-6:**
```
edit("workspace/findings.md", 
  "**Next**: Check deployment and config change logs around 14:00",
  `**Next**: Check deployment and config change logs around 14:00

## Round 2 (correlation)
- deployments.json: No deployments between 13:00-15:00
- config-changes.json: cfg-201 at 14:10 — Redis cluster maintenance started
- error-rates.csv: Error spike begins exactly at 14:12 (2min after cfg-201)
- **Root cause likely**: cfg-201 Redis maintenance caused connection failures
- **Next**: Verify which services were affected and check if maintenance completed
`)
```

**After reads 7-9:**
```
edit("workspace/findings.md",
  "**Next**: Verify which services were affected and check if maintenance completed",
  `**Next**: Verify which services were affected and check if maintenance completed

## Round 3 (impact assessment)
- user-service.log: 503 errors from 14:12-14:45, all Redis-related
- notification-service.log: Queue backlog started 14:15, cleared by 15:00
- **Affected services**: auth, payment, user, notification (all Redis-dependent)
- **Timeline**: cfg-201 at 14:10 → errors at 14:12 → auto-recovery by 15:00
- **Next**: Write final report
`)
```

**The pattern: read 3, write 1, read 3, write 1, read 3, write 1.** Never read more than 3 times without writing.

### 3. Write the final report referencing your findings
When you have enough evidence, write the final report:

```
write("workspace/root-cause-report.md", `# Root Cause Report
...your analysis...
See workspace/findings.md for detailed investigation log.
`)
```

### 4. ⚠️ ALWAYS reference workspace files in finish()
This is critical — your finish() call MUST list workspace deliverables:

```
finish({
  status: "success",
  summary: "Identified root cause: Redis maintenance (cfg-201) caused cascading failures across 4 services",
  deliverables: [
    { path: "workspace/root-cause-report.md", description: "Root cause analysis report" },
    { path: "workspace/findings.md", description: "Investigation findings log with 3 rounds of analysis" }
  ]
})
```

**Never call finish() without a `deliverables` array listing your workspace files.** If you wrote files to workspace/, they must appear in deliverables.

## Cadence Checklist (use this mentally)
- [ ] Read 3 files → wrote Round 1? 
- [ ] Read 3 more → wrote Round 2?
- [ ] Read 3 more → wrote Round 3?
- [ ] Final report written?
- [ ] finish() includes deliverables array with all workspace files?

## Anti-patterns
- ❌ Reading 4+ files before writing anything — STOP at 3 and write
- ❌ Writing early but then reading 6+ files without updating — maintain the cadence throughout
- ❌ Only writing the final report — intermediate rounds must be captured
- ❌ Rewriting findings.md from scratch each time — use edit() to append rounds
- ❌ Calling finish() without deliverables — ALWAYS list workspace files in deliverables
