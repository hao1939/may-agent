---
title: "A Source URL Is Traceability, Not Incident Validation"
source: hn
date: 2026-08-26
last_updated: 2026-08-26
type: finding
tags: [hn, agent-security, incident-data, datasets, evaluation, provenance]
relevance: high
---

# A Source URL Is Traceability, Not Incident Validation

## Finding

HN surfaced the public **AI Agent Security Incidents 2026** dataset as “1,000 incidents classified.” The artifact is useful less as a settled incident corpus than as a warning about dataset admission: a verifiable source URL can establish where a row came from, but it cannot establish that the row is an AI-agent incident, that its severity is calibrated, or even that it describes an observed incident rather than research.

The versioned `AISI_v0.1_20260822.json` release is unusually candid about this boundary. Its metadata says all 1,018 accepted rows were classified by a local Llama 3.1 8B pipeline with **no manual verification**, warns that research and demonstrations may be misclassified, and defines `confidence` as data completeness rather than validity. Yet the same release reports a 95.2% acceptance rate and 81 critical incidents, while the dataset card presents “1,000+ classified incidents” and 82 critical incidents without foregrounding those distinctions.

## What the artifact actually contains

Scout inspected the public files at repository revision `8cac3740381bcd484967e291b2ad05361b157a72`:

- The audit JSON contains **1,018 accepted and 51 rejected rows**. Of the accepted set, 644 (63.3%) come from `cve_nvd` or `cve_nvd_deep`; another 255 come from HN stories, deep fetches, comments, or RSS.
- The schema declares ten allowed `faille_type` values, but the release statistics include eleven additional labels such as `command_injection`, `path_traversal`, `cross_site_scripting`, `memory_corruption`, and the model-originated `slopsploit_attack_chain`. The taxonomy is therefore not closed under its own published contract.
- The 1,000-line `data.jsonl` file is not the accepted incident table advertised by the card. Its early rows include ordinary HN posts labeled `Not an incident`, use numeric string keys instead of the documented field names, and expose a wider pipeline record. A consumer selecting the most obvious machine-readable file could silently train on negatives or misread columns.
- The CSV has only 100 rows, all labeled medium/high/critical, and no field documenting whether it is a sample, filtered slice, or canonical release. Its one `arxiv_deep` row treats a theoretical vector-retrieval poisoning paper as a critical incident with an unknown incident date.
- Every accepted audit row has a distinct `source_url`, which is valuable provenance. It still leaves relevance, event status, severity, duplication across underlying events, and claim quality unaudited.

These observations do **not** prove that all or most rows are false. Scout did not manually adjudicate a representative sample, and the release is openly labeled `0.1-audit`. They do show that counts such as “1,018 accepted,” “81 critical,” or vendor rankings should not be used as incident-rate evidence without an independent admission audit.

## Reusable pattern: separate collection from adjudication

An agent-security incident corpus should expose at least four distinct stages:

1. **Candidate collection** — a source item was retrieved and retained with stable provenance.
2. **Relevance adjudication** — evidence links the item to an autonomous or tool-using agent, rather than merely to AI infrastructure or security generally.
3. **Event-status adjudication** — distinguish exploited incident, disclosed vulnerability, proof of concept, research result, commentary, and duplicate report.
4. **Severity adjudication** — bind severity to an explicit rubric, evidence, and reviewer/version identity.

Rows should retain every stage rather than collapsing them into `accepted`. Classifier confidence should be split into relevance probability, field-extraction confidence, and severity confidence; “completeness” should not occupy the field consumers are most likely to interpret as correctness. Published aggregates should be computed only over a named adjudication state and release manifest.

A lightweight audit can then sample by source and class, estimate precision with confidence intervals, test taxonomy conformance, and publish disagreements. Until that exists, the best use of this release is candidate discovery with primary-source follow-up—not benchmark scoring, trend estimation, or claims about the frequency of agent failures.

## Sources

- **HN:** https://news.ycombinator.com/item?id=49446376
- **Source:** https://huggingface.co/datasets/gemmozero/ai-agent-security-incidents
- **Dataset API metadata:** https://huggingface.co/api/datasets/gemmozero/ai-agent-security-incidents
- **Versioned audit JSON:** https://huggingface.co/datasets/gemmozero/ai-agent-security-incidents/blob/8cac3740381bcd484967e291b2ad05361b157a72/AISI_v0.1_20260822.json
- **Versioned raw JSONL:** https://huggingface.co/datasets/gemmozero/ai-agent-security-incidents/blob/8cac3740381bcd484967e291b2ad05361b157a72/data.jsonl
- **Versioned CSV:** https://huggingface.co/datasets/gemmozero/ai-agent-security-incidents/blob/8cac3740381bcd484967e291b2ad05361b157a72/ai_agent_security_incidents_v0.1.csv
- **Pipeline repository:** https://github.com/Legion33shadow/legion-n8n-shield
