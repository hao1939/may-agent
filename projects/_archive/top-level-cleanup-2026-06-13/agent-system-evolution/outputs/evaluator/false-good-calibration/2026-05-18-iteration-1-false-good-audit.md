# Iteration 1 audit: recent `evaluation.false_good` patterns

## Scope
Audit recent false-good overturns to identify what the heuristic success-candidate path is over-crediting. This iteration does **not** recommend threshold changes.

## Sample used
- Runtime DB: `events` rows where `event_type='evaluation.false_good'`
- Recent sample: latest 30 false-good events
- Artifacts reviewed in depth:
  - `agents/evaluator/workspace/aftermath/s_1779082705174_76.md`
  - `agents/evaluator/workspace/aftermath/s_1779066050617_1.md`
  - `agents/evaluator/workspace/aftermath/s_1779064237055_0.md`
  - `agents/evaluator/workspace/aftermath/s_1779060603230_539.md`
  - `agents/evaluator/workspace/aftermath/s_1779053381283_494.md`
  - `agents/evaluator/workspace/aftermath/s_1779053381203_492.md`
  - `agents/evaluator/workspace/aftermath/s_1779051581282_486.md`
  - `agents/evaluator/workspace/aftermath/s_1779051581305_487.md`
  - `agents/evaluator/workspace/aftermath/s_1779049781202_476.md`
  - `agents/evaluator/workspace/aftermath/s_1779049781305_479.md`
- Workflow code inspected:
  - `agents/evaluator/workflows/evaluator-aftermath.ts` (`transcriptOutputSignals()` and `classifyEvaluationLane()`)

## What the recent sample says

### 1) The dominant false-good pattern is **artifact-signal contamination**, not borderline thresholds
Recent false-good route reasons in the last-30 sample:
- `good session with material output: project artifact` — **18**
- `good session with material output: project artifact, knowledge update` — **11**
- `good session with material output: file write/edit, knowledge update` — **1**

So **29/30** recent false-good cases were routed as good because the heuristic believed the session produced a **project artifact** and/or **knowledge update**.

### 2) Most overturns are low-op heartbeat/no-op sessions
Recent false-good reviewed outcomes:
- `acceptable`: **23**
- `needs_improvement`: **7**

Recent false-good opCount profile:
- `acceptable` overturns: avg **8.0** ops, min **4**, max **14**
- `needs_improvement` overturns: avg **4.4** ops, min **4**, max **6**

This is consistent with reviewer notes: many routed-good sessions were short heartbeats or routine checks that did not create durable output.

### 3) Agent mix is broad, but the failure is most visible in heartbeat-style work
Lifetime false-good counts by agent are spread across multiple agents:
- may: **160**
- arc: **155**
- dev: **150**
- scout: **64**
- tech-lead: **5**

That spread argues against an agent-specific quality issue and toward a routing/scoring pattern.

## Primary mechanism: `transcriptOutputSignals()` is too easily polluted by transcript text
In `agents/evaluator/workflows/evaluator-aftermath.ts`, `transcriptOutputSignals()` currently adds:
- `project artifact` if `ownText` matches `projects/.../(outputs|project.md|journal.md)`
- `knowledge update` if `ownText` matches `agents/.../knowledge/`
- `git commit` if `ownText` contains `git commit`
- `file write/edit` if `ownText` contains a write/edit tool call

`classifyEvaluationLane()` then routes any `good` session with one of those “material signals” to `success_candidate`.

### Why this over-credits recent sessions
For many heartbeats, `ownText` contains **`git status --short` output**, and that output includes unrelated dirty paths such as:
- `projects/...`
- `agents/evaluator/knowledge/...`
- other agents' dirty files

That means a session can do **no write/edit at all**, but still get tagged as:
- `project artifact`
- `knowledge update`

simply because it **looked at ambient dirt**.

## Concrete false-good clusters

### Cluster A — Ambient dirty-paths in `git status` masquerade as real output
This is the dominant cluster.

Representative sessions:
- `s_1779066050617_1` (`may`) — aftermath says: “this session produced no project artifact or knowledge update” and “did not actually take the promised improvement action.”
- `s_1779064237055_0` (`may`) — aftermath says the route’s `project artifact / knowledge update` signal is false; no `write`, `edit`, or `message` calls occurred.
- `s_1779053381283_494` (`dev`) — aftermath says there was “no actual project artifact or knowledge update”; value was only disciplined low-signal triage.
- `s_1779051581305_487` (`arc`) — aftermath says the only visible output was runtime-managed `agents/arc/last-session.md`, not a durable artifact.
- `s_1779049781202_476` (`may`) and `s_1779049781305_479` (`arc`) — aftermath explicitly calls the routing signals false positives.

Mechanism visible in transcripts:
- The sessions run `git status --short`
- The output lists unrelated dirty `projects/...` and `agents/.../knowledge/...` paths
- `transcriptOutputSignals()` treats those strings as if the session itself produced artifacts

**Calibration implication:** success-candidate routing should not infer material output from arbitrary transcript text or git-status noise.

### Cluster B — Heartbeat/no-op maintenance is being described as substantive success
Some sessions did have real operational value, but not the kind of durable output that warrants a strong `good` route.

Representative sessions:
- `s_1779053381283_494` (`dev`) — honest no-op heartbeat, correctly blocked on unrelated dirty worktree, but not a material-output success.
- `s_1779051581305_487` (`arc`) — health check only; skipped the heartbeat’s required coherence-audit/knowledge step.
- `s_1779064237055_0` (`may`) — stopped at “System is healthy. No action needed.” despite instructions to pursue an improvement question.

These are not threshold problems. Reviewers downgraded because the routed “good” story overstated the substance of the session.

**Calibration implication:** a session can be operationally correct yet still only be `acceptable` if it produced no new durable artifact and no concrete forward action.

### Cluster C — Real writes can still be over-credited when verification/substance is weak
This was rare in the recent sample, but it matters because it is a different failure mode.

Representative session:
- `s_1779082705174_76` (`scout`) — route reason was `file write/edit, knowledge update`, and the session did create a new KE plus digest update. It was still overturned to `acceptable` because the session:
  - skipped post-write `read()` verification before finish
  - did not report the broken KE-ID helper after fallback

Contrast case:
- `agents/evaluator/workspace/deep-evals/s_1779086438752_91.json` shows a `good` scout session where the artifact was judged substantively useful despite a few wasted queries.

**Calibration implication:** “file write + knowledge update” is necessary evidence for review, but not sufficient for `good`. The success-candidate path still needs reviewer skepticism when verification or novelty is weak.

## What is being over-credited

### Over-credited pattern 1: unrelated path mentions in transcript text
Especially from `git status --short` output.

### Over-credited pattern 2: workflow-linked/no-op heartbeats being narrated as material-output successes
These often deserve `acceptable` at best unless they create a durable artifact or concrete operational action.

### Over-credited pattern 3: any real write being treated as strong success even when verification/substance is weak
This is the smaller cluster, but it is the meaningful non-heartbeat false-good pattern.

## Recommended hardening for the next iteration
Do **not** change thresholds first. Harden the heuristic judgment path instead.

1. **Scope `project artifact` and `knowledge update` to actual write/edit evidence**
   - Detect from write/edit tool-call paths, not generic transcript regex matches.
   - Do not count `git status` output, prompt text, or unrelated dirty paths.

2. **Exclude runtime/generated hygiene artifacts from “material output”**
   - Especially `last-session.md`-style wrapper output and incidental hygiene evidence.

3. **Add a heartbeat/no-op guard before routing to strong success-candidate review**
   - If the session is mainly query/read/git-status + finish and produced no durable artifact or concrete action, route as `routine_ok` or weak candidate instead of strong material-output success.

4. **Keep reviewer skepticism for real-write sessions lacking verification/substance**
   - Missing post-write `read()` verification, unsupported claims, or weak novelty should still block `good` even when a file was written.

## Bottom line
The current churn is mostly **not** “good vs acceptable threshold noise.” The heuristic is frequently manufacturing “material output” from **ambient transcript strings**, especially dirty-path listings from `git status --short`. That false signal then pushes routine heartbeats into the success-candidate lane, where review correctly downgrades them. The next iteration should harden **signal extraction and success-candidate eligibility**, not relax the metric further.