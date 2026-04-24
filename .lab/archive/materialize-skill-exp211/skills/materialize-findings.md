# Skill: Materialize Findings During Investigation

**When to use:** Any multi-step investigation, debugging, or analysis task that requires reading 4+ files or running 4+ diagnostic commands.

## Core Rule
**After every 3–4 read/analysis operations, write your findings so far to a workspace file.** Don't hold everything in memory — persist it to disk.

## Why
- If the session crashes, your partial findings survive
- Written findings are easier to cross-reference than scrolling back through tool output
- You can spot patterns more easily when findings are organized in a file

## Protocol

### 1. Start a findings file early
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

### 2. Update every 3–4 operations
After reading more files, **edit** (don't rewrite) the findings file:

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

### 3. Write the final report referencing your findings
When you have enough evidence, write the final report. Then update findings with resolution:

```
edit("workspace/findings.md",
  "**Next**: Verify which services were affected",
  `**Next**: Verify which services were affected

## Resolution
- Root cause: Redis cluster maintenance (cfg-201) at 14:10 triggered simultaneous restart
- Affected: auth, payment, user, notification services (all depend on Redis)
- Fix: Rolling restart with connection drain needed
- Report written to workspace/root-cause-report.md
`)
```

### 4. Reference workspace files in finish()
```
finish({
  status: "success",
  deliverables: [
    { path: "workspace/root-cause-report.md", description: "Root cause analysis" },
    { path: "workspace/findings.md", description: "Investigation findings log" }
  ]
})
```

## Anti-patterns
- ❌ Reading 8+ files before writing anything — you'll lose context
- ❌ Only writing the final report — intermediate steps aren't captured
- ❌ Rewriting findings.md from scratch each time — use edit() to append
- ❌ Finishing without referencing workspace deliverables
