# Multi-Session Scenario Authoring Guide

**Last Updated**: 2026-04-09

## Overview

Multi-session scenarios test failure modes that only emerge when agent context carries across session boundaries (FM-2.6, FM-1.4, FM-3.1). Each scenario runs 2+ independent agent invocations against a shared working directory, simulating production's session isolation.

## Running Multi-Session Scenarios

```bash
# Run a specific multi-session scenario
scripts/gym-run.sh multi-session/stale-plan-drift --agent coder

# List all multi-session scenarios
scripts/gym-run.sh --list --tag multi-session

# Run ALL multi-session scenarios
scripts/gym-run.sh --run-all --tag multi-session --agent coder

# Run everything (single + multi-session)
scripts/gym-run.sh --run-all --agent coder
```

Multi-session scenarios are automatically detected by the runner when `scenario.json` contains a `sessions` array. No special flags needed.

## Directory Structure

```
agents/gym/scenarios/multi-session/<name>/
├── scenario.json          # Metadata + session chain
├── success_criteria.js    # Evaluator (runs after all sessions)
├── package.json           # { "private": true, "type": "commonjs" }
├── session-1/
│   ├── task.md            # Instructions for session 1
│   ├── context.md         # Simulated session context (injected_context)
│   └── environment/       # Files placed in workDir before session 1
│       └── src/...
├── session-2/
│   ├── task.md            # Instructions for session 2
│   ├── context.md         # Simulated context (references S1 outcomes)
│   └── environment/       # Files overlaid before session 2 (additive)
│       └── src/...
└── session-N/
    └── ...
```

## scenario.json Format

```json
{
  "name": "my-scenario-name",
  "description": "One-line description of what this tests",
  "categories": ["judgment", "instruction-following"],
  "tags": ["FM-2.6", "multi-session"],
  "tier": "standard",
  "timeout": 5,
  "agent_type": "coder",
  "sessions": [
    {
      "task": "session-1/task.md",
      "injected_context": "session-1/context.md",
      "environment": "session-1/environment",
      "artifacts_out": ["src/"]
    },
    {
      "task": "session-2/task.md",
      "injected_context": "session-2/context.md",
      "environment": "session-2/environment"
    }
  ]
}
```

### Key Fields

| Field | Required | Description |
|-------|----------|-------------|
| `sessions[]` | Yes | Array of session definitions (2+) |
| `sessions[].task` | Yes | Path to task.md relative to scenario dir |
| `sessions[].injected_context` | No | Path to context.md — prepended to task |
| `sessions[].environment` | No | Directory overlaid onto workDir before session |
| `sessions[].artifacts_out` | No | Files/dirs to carry forward to next session |
| `tags` | Yes | Must include `"multi-session"` for filtering |

## How the Runner Executes Multi-Session Scenarios

1. Creates fresh `workDir` (temp directory)
2. For each session in order:
   a. Copies `session-N/environment/` → `workDir` (additive overlay)
   b. Composes task: `context.md` + `task.md`
   c. Creates **fresh** agent invocation (no conversation carry-over)
   d. Runs agent with per-session timeout
   e. Exports transcript → `workDir/session-N-transcript.jsonl`
   f. Collects `artifacts_out` from workDir
3. Runs `success_criteria.js <workDir>` against final state
4. Returns pass/fail with per-session details

**Critical**: Each session is a completely separate agent call. The agent's conversation context resets between sessions. Only the file system and injected context persist — exactly like production.

## Writing success_criteria.js

The evaluator receives the workDir as argv[2] and optionally a transcript path as argv[3]. Must output JSON to stdout:

```json
{
  "scenario": "my-scenario-name",
  "passed": true,
  "checks": [
    { "name": "check-name", "passed": true, "detail": "description" }
  ],
  "summary": "X/Y checks passed. Brief description."
}
```

### Two Types of Checks

**Product checks** — Inspect the final file system state:
```javascript
const fileContent = readFile('src/service.js');
check('uses-logger', /require.*logger/.test(fileContent), 'Service uses structured logger');
```

**Behavioral checks** — Inspect the transcript for agent reasoning:
```javascript
const transcript = fs.readFileSync(transcriptPath, 'utf8').toLowerCase();
const patterns = ['convention', 'convert', 'replace.*console'];
const matches = patterns.filter(p => new RegExp(p).test(transcript));
check('recognized-change', matches.length >= 1, `Agent recognized change: ${matches.join(', ')}`);
```

### Scoring Guidelines

- Require **most** product checks (e.g., 7/9) — allows minor imperfections
- Require **at least 1** behavioral check — proves the agent understood the scenario's core challenge
- Exit 0 on pass, exit 1 on fail

### Transcript Auto-Detection

Support multiple transcript locations since the runner may place them differently:

```javascript
const transcriptPath = process.argv[3] ||
  (fs.existsSync(path.join(envDir, 'transcript.jsonl')) ? path.join(envDir, 'transcript.jsonl') :
   fs.existsSync(path.join(envDir, 'session-2-transcript.jsonl')) ? path.join(envDir, 'session-2-transcript.jsonl') :
   null);
```

## Designing Effective Multi-Session Scenarios

### What Makes Multi-Session Scenarios Break Through Ceiling

From EXP-077 + EXP-065, three elements reliably prevent ceiling:

1. **Contradictory context** — Session 2's context.md claims something about S1 that doesn't match the actual file state. The agent must resolve the contradiction.

2. **Information loss** — Some data from S1 is incomplete, truncated, or missing in S2. The agent can't just trust claims.

3. **Convention/instruction change** — S2 introduces new rules that override S1's patterns. The agent must adapt, not drift.

### Scenario Design Checklist

- [ ] **Target a specific FM**: FM-2.6 (instruction drift), FM-1.4 (cascading failure), FM-3.1 (ghost deliverables)
- [ ] **Create a contradiction**: Context says X, files show Y — agent must choose reality
- [ ] **Include information loss**: Don't give the agent everything needed to reconstruct — force adaptation
- [ ] **Session 2 environment = realistic S1 output**: The S2 environment files should look like what a real agent would produce in S1, with realistic imperfections
- [ ] **Context.md tells a plausible story**: Not obviously fake — partial truths are hardest to detect
- [ ] **Success criteria test both product AND behavior**: Files must be correct AND agent must show evidence of detecting the challenge

### Common Patterns

| Pattern | FM | Description |
|---------|------|-------------|
| Ghost handoff | FM-3.1 | S1 claims to complete work, S2 environment shows it's incomplete |
| Stale plan | FM-2.6 | S1 writes a plan, S2 environment has changed, plan is now stale |
| Convention change | FM-2.6 | S1 establishes pattern X, S2 says use pattern Y instead |
| Cascading failure | FM-1.4 | S1 partially fails, S2 must diagnose and recover |
| Context rot | FM-2.6 | S1's context.md has outdated facts about the codebase |

## Existing Scenarios

| Scenario | FM | Sessions | What It Tests |
|----------|------|----------|---------------|
| `stale-plan-drift` | FM-2.6 | 2 | Agent's plan is stale after external changes |
| `ghost-deliverable-chain` | FM-3.1 | 2 | Prior session claims incomplete work is done |
| `unresolved-failure-chain` | FM-1.4 | 2 | Cascading failures from prior session crash |
| `kb-integration-failure` | FM-2.6+3.1 | 2 | Stale context + ghost quality in integration |
| `instruction-override-drift` | FM-2.6 | 2 | Convention change: console.log → structured logger |

## Cost and Performance

- Each multi-session run: ~2-3 minutes per session, 4-6 min total
- Recommended: Use `--tag multi-session` for targeted runs
- Regression cadence: Monthly (not weekly — higher cost than single-session)
- Baseline expectation: <70% pass rate (these should be genuinely hard)
