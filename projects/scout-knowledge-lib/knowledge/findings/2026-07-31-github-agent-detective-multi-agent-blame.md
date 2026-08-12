---
title: "Agent Detective — OTEL-Based Blame Analysis for Multi-Agent Systems"
source: github
date: 2026-07-31
last_updated: 2026-07-31
type: finding
tags: [github, multi-agent, observability, evaluation, opentelemetry, root-cause-analysis]
Repo: https://github.com/Thomeras/agent_detective
---

# Agent Detective — OTEL-Based Blame Analysis for Multi-Agent Systems

## Summary

Agent Detective is an eval framework that ingests standard OpenTelemetry traces from multi-agent runs, rebuilds the execution graph, and identifies the first node where quality broke — naming the origin agent, the propagation path, and downstream cost.

## Key Details

- **Repo:** [Thomeras/agent_detective](https://github.com/Thomeras/agent_detective) (4★, created 2026-07-28)
- **Language:** Python 3.12+
- **License:** BSL 1.1 (instrumentation SDK is Apache-2.0)
- **Status:** Beta (classifications still shifting between minor versions)

## How It Works

1. **Ingest:** Accepts OTEL traces from any OpenInference/OpenLLMetry-instrumented agent — no code change required.
2. **Graph reconstruction:** Rebuilds the multi-agent execution graph from trace spans.
3. **Blame analysis:** Finds the "cut point" — the first agent where quality broke — with confidence scores.
4. **Defect classification:** Labels issues like "contract breach" (a carried parameter silently rewritten), loop detection, etc.
5. **CI integration:** Exit code 0 = clean, 1 = incident, 2 = could not run. Designed as a CI gate.

## Usage Pattern

```bash
pip install agent-detective
detective capture --once --out run.json   # capture a trace
detective analyze run.json                # verdict with exit code for CI
detective analyze run.json --markdown     # findings brief for a coding agent
detective doctor run.json                 # assess trace quality
```

## Why This Matters

- **Novel angle on multi-agent eval:** Most eval tools measure end-to-end quality. This one names *which agent* in a pipeline caused the failure — a forensic approach.
- **OTEL-native:** Leverages existing observability infrastructure rather than requiring a proprietary tracing format. Any agent system already emitting OTEL spans works out of the box.
- **CI-gatable blame:** The exit-code design means teams can block merges when an agent pipeline has an identified quality incident — and the report tells you where to look.
- **Connects to:** The broader trend of agent observability tooling (trace-file-lineage for provenance, waggle for handoff attribution). Agent Detective focuses specifically on failure attribution in pipelines.

## Limitations

- Very early (4★, beta, classifications not stable yet).
- BSL 1.1 license limits commercial hosted use.
- Confidence scores are reported but methodology not yet fully documented.
