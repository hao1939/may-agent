# Finding: Workflow Health — Apr 16

**Date**: 2026-04-16 07:00 UTC  
**Window**: 24h (Apr 15 07:00 – Apr 16 07:00)  
**Prior measurement**: Apr 12: 27.1% adoption

## Workflow Adoption

**Overall**: 18.5% (191/1032 sessions have workflowRunId)  
**Work agents only** (excluding evaluator/may/amy/qa): **31.6% (191/604)** — up from 27.1% on Apr 12.

| Agent | Total | WF Sessions | Rate |
|-------|-------|-------------|------|
| bob | 113 | 65 | 57.5% |
| optimizer | 98 | 47 | 48.0% |
| tech-lead | 123 | 34 | 27.6% |
| coder | 120 | 23 | 19.2% |
| coach | 97 | 20 | 20.6% |
| scout | 53 | 2 | 3.8% |

**Bob** and **optimizer** are the heaviest workflow users. Scout barely uses workflows.

## Op Efficiency: WF vs Non-WF

| Category | Avg Ops | Sessions |
|----------|---------|----------|
| Workflow | 17.8 | 191 |
| Non-workflow | 8.3 | 841 |

Workflow sessions use ~2x more ops on average. This is expected — workflow sessions tend to be substantive work, while non-WF includes lightweight heartbeats and calls.

## WF Ops by Agent

| Agent | Avg Ops | Max Ops | N |
|-------|---------|---------|---|
| scout | 39.0 | 49 | 2 |
| coder | 23.0 | 74 | 23 |
| coach | 21.7 | 80 | 20 |
| bob | 19.4 | 86 | 65 |
| optimizer | 16.4 | 42 | 47 |
| tech-lead | 9.8 | 23 | 34 |

**Observation**: Bob has outliers up to 86 ops (gym experiment runs), and coder up to 74 ops. Tech-lead's workflow sessions are lean (avg 9.8 ops) — good sign for the architecture review workflows.

## D-o-R Phase Check

D-o-R sessions found in 24h are primarily tech-lead architecture reviews (2-10 ops each). No D-o-R sessions exceeding the 15-op cap were observed.

## verify-wrap Usage

**Zero verify-wrap sessions** detected in 24h. The workflow exists but is not being called. This is expected — the DELIVERABLES_CHECKLIST guard replaced verify-wrap's original purpose, and agents now do inline verification instead.

## High-Op Workflow Outliers (>50 ops)

| Session | Agent | Ops | Task |
|---------|-------|-----|------|
| s_..._19 | bob | 86 | Design 2 new gym scenarios |
| s_..._54 | coach | 80 | Promoted Skill Regression Check |
| s_..._185 | coder | 74 | Reference task handling |
| s_..._51 | bob | 68 | Design 2 new gym scenarios |
| s_..._392 | bob | 59 | EXP-167 persistent task iteration |

These are all substantive work — gym design, experiment runs, regression checks. No runaway/wasted sessions.

## Summary

| Metric | Apr 12 | Apr 16 | Trend |
|--------|--------|--------|-------|
| Adoption (work agents) | 27.1% | 31.6% | ↑ +4.5pp |
| verify-wrap usage | — | 0 | Deprecated in practice |
| D-o-R over 15-op cap | — | 0 violations | Holding |
| Highest WF ops | — | 86 (bob) | Acceptable (gym work) |

**Assessment**: Workflow adoption is healthy and growing. The D-o-R budget caps are holding. verify-wrap has been naturally superseded by the DELIVERABLES_CHECKLIST pattern. No intervention needed.
