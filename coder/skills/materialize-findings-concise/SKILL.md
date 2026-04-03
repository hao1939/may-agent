# Skill: Materialize Findings (Concise)

## When to Apply
During multi-step investigations — reading multiple files, analyzing logs, correlating data.

## Three Rules

### 1. EARLY WRITE — Write your first finding within the first 3 tool calls
After reading 2-3 data sources, immediately write a workspace file with initial findings:
```
write("workspace/findings.md", "## Initial Findings\n- [what you found so far]")
```
Don't wait until you have the full picture. Write the partial picture NOW.

### 2. WRITE EVERY 3 COMMANDS — Maximum gap of 3 analysis calls between writes
After every 3 analysis commands (read, grep, bash), append to your findings file:
```
edit("workspace/findings.md", ...) // add new section with latest findings
```
Count your analysis calls. After 3, you MUST write before continuing.

### 3. REFERENCE IN FINISH — Always include deliverables in finish()
When calling finish(), list every workspace file you created:
```
finish({
  deliverables: [
    { path: "workspace/findings.md", description: "Investigation findings" },
    { path: "workspace/root-cause-report.md", description: "Final report" }
  ]
})
```

## Quick Pattern
```
[read] → [read] → [read] → WRITE findings → [read] → [bash] → [bash] → WRITE more → ... → WRITE report → finish(deliverables: [...])
```
