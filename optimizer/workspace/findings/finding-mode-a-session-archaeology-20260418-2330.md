# Mode A: Session Archaeology — use-persistent-task Deep Dive (Apr 18, 23:30 UTC)

## Investigation Target
Coach's use-persistent-task sessions dominating high-op list: 133 ops (running), 65 ops, 48 ops.

## Findings

### 1. The use-persistent-task Project is a Legitimate Multi-Session Research Effort
- **30 sessions** spanning 07:53–22:54 UTC on Apr 18, **590 total ops**
- This is a single coherent project: coach iterating on a gym scenario to teach agents to use the persistent-task workflow
- Progression: baseline (0%) → text interventions (40-60%) → infrastructure bug fixes → structural interventions → still iterating

### 2. The Three High-Op Sessions Are Quality-Rated and Legitimate

| Session | Ops | Status | Quality | What It Did |
|---------|-----|--------|---------|-------------|
| s_1776551125350_659 | 133 | running | n/a | Analyzing structural intervention failure + designing v2 |
| s_1776540115465_532 | 65 | done | 1.0 | Diagnosing scenario infrastructure bugs (FM-1/FM-2) |
| s_1776545680528_605 | 48 | done | 1.0 | Testing structural intervention with n=10 gym runs |

Both completed sessions got **quality=1.0, verdict=good**. The cost is driven by:
- **Gym runs** (each ~3-5 ops of overhead when running serially)
- **Transcript analysis** (reading gym session outputs to diagnose failure modes)
- **Scenario iteration** (create variant → test → analyze failures → redesign)

### 3. Cost Profile of the Full Project
- 590 ops across 30 sessions = **~20 ops/session average** (reasonable)
- The project follows a sensible trajectory: hypothesis → experiment → diagnosis → fix → re-experiment
- No child sessions spawned (coach does all work inline, no delegation)
- Gym-batch.sh is used in some sessions but many still use serial gym-run.sh

### 4. The 133-op Session (Still Running)
This session is working on a tough problem: the scenario has 0% baseline across 93+ runs, and even structural interventions only reach 12.5%. The high op count is driven by:
- Reading multiple transcript files to understand pass/fail patterns
- Designing and implementing a new stronger intervention
- Running gym trials to validate

### 5. Waste Opportunities (Minor)
- **Serial gym runs still used** in some sessions despite gym-batch.sh being available — could save 2-3 ops per batch
- **No workflow structure** — only 1 of 10 work sessions used a workflow. But this is expected: iterative experiment design doesn't map to existing workflow templates
- **Session fragmentation** — 8 sessions under 10 ops that could potentially be consolidated, but these are mostly heartbeats (not waste)

## Verdict
**NOT waste. Legitimate research complexity.** The use-persistent-task project is coach's hardest unsolved problem (0% baseline after 93+ runs). The high-op sessions are driven by genuine diagnostic and experimental work, both evaluated at q=1.0. No intervention recommended.

## Recommendation
- **NO_DISPATCH** — Cost is justified by task complexity. Coach is following good experimental methodology (KE-010: baseline first, KE-123: one intervention at a time).
