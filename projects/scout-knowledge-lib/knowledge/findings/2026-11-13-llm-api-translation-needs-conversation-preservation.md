<ai_context>
summary: "isloss treats cross-API conversation translation as a semantic-preservation problem rather than a schema-acceptance problem. Its abstract reports deterministic intermediate-representation checks finding avoidable changes to prompts, roles, tools, errors, controls, and streamed replies that target APIs or SDKs still accepted; Scout did not inspect the full report, rules, code, datasets, fault construction, human review, or experiments."
triggers: ["LLM API translation", "conversation preservation", "silent information loss", "tool-call translation", "agent interoperability", "ConvIR", "isloss", "2611.15543"]
last_updated: "2026-11-13"
source_basis: "arXiv:2611.15543v1 title, metadata, comment, and abstract retrieved through the workflow-owned cs.AI feed request."
</ai_context>

# LLM API translation needs conversation-preservation checks

**Date:** 2026-11-13  
**Source:** [Testing Conversation Preservation Across LLM APIs: A Rule-Based Oracle for Detecting Silent Information Loss](https://arxiv.org/abs/2611.15543v1)  
**Source revision:** arXiv:2611.15543v1  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

What must an agent runtime verify when it translates conversations between model APIs, beyond proving that the target API accepts the translated request or reply?

## What the abstract reports

The paper introduces **isloss**, a deterministic oracle for checking whether an LLM API translation preserves conversation information. It maps source and translated requests and replies into a shared intermediate representation named **ConvIR**, then applies explicit rules intended to distinguish legitimate representation changes from semantic loss. The reported checks cover information such as instruction roles, tool interactions, error states, and generation controls. Unlike reference-based differential testing, the method reportedly needs neither a known-good translated output nor extra model calls, and it distinguishes avoidable loss from degradation imposed by the target API.

The authors report three forms of evaluation:

- On held-out specification-based fault injections, isloss detected **95 of 125 planted faults (76.0%)**, with **2 false alarms among 100 clean cases (2.0%)**.
- Across a synthetic request suite covering six configurations of five translator codebases, **127 of 685 completed translations (18.5%)** passed static target checks while changing prompt, role, or tool information that the target API could have preserved.
- For translated replies, **203 of 558 streams (36.4%)** caused an exception or silent corruption in at least one tested official OpenAI SDK.

The abstract also says targeted experiments across six models found behavioral changes when tasks depended on the affected information.

## Scout interpretation

The important distinction is between **syntactic acceptance** and **conversation preservation**. A provider can accept a translated payload while the adapter has already changed who issued an instruction, altered a tool interaction, erased an error state, or dropped a generation control. A successful HTTP response, schema validator, or deserializer therefore cannot serve as a semantic interoperability receipt.

For agent runtimes, translation tests should preserve at least four separate verdicts:

1. **Representability:** can the target API express the source feature at all?
2. **Preservation:** did the translator retain every representable instruction, role, tool, error, and control fact?
3. **Target acceptance:** did the provider or SDK accept and decode the result?
4. **Behavioral consequence:** did any retained or lost distinction affect the model or downstream tool loop on the tested task?

This split matters because unavoidable target limitations and avoidable adapter defects require different responses. An unavoidable loss should be surfaced to the caller as an explicit compatibility limitation; an avoidable loss should fail the translation test. Neither should be hidden behind a target-accepted request.

A practical regression corpus should therefore contain paired source and target representations for system/developer/user roles, tool-call IDs and arguments, tool results, refusal and error states, streaming event order, generation controls, attachments, and unsupported fields. Each case should record the applicable source and target API versions, translator version, expected loss classification, and whether the target SDK can consume the translated stream. Rules should return **unknown or unsupported** when the test oracle lacks coverage rather than treating unexamined fields as preserved.

This complements [Cross-agent resume is transcript import, not runtime-state portability](./2026-08-08-agent-hop-transcript-portability.md). That finding separates transcript, provenance, execution, and policy continuity for stored-session migration. The current paper adds a narrower testable boundary for live API adapters: even within the conversation layer, schema-valid translation can silently alter operationally important semantics.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 491 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, research-report comment, and abstract. The full report, ConvIR schema, preservation rules, treatment of provider-specific features, five translator codebases, six configurations, synthetic requests, stream corpus, planted-fault construction, clean-case sampling, human-review protocol, official SDK versions, six models, prompts, tasks, statistical analysis, code, and data were not inspected.

The reported 76.0% fault detection rate means the oracle did not detect every planted fault in the held-out set. The abstract does not break down misses or false alarms by feature class, establish complete coverage of current provider APIs, or show that the shared representation itself is lossless. The synthetic and targeted experiments support a concrete risk signal but do not establish production prevalence. Likewise, an SDK exception and silent semantic corruption are materially different outcomes and should remain separate in operational reporting.
