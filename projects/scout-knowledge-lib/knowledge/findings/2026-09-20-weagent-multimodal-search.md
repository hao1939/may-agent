<ai_context>
summary: "An official WeLM team post describes WeAgent-MMSearch as keeping retrieved images available for multi-turn reasoning and citation, and introduces VisTarget-Bench to separate image-retrieval failures from visual-understanding failures. A later secondary XHS post adds a useful training claim: fault-aware GSPO recovers or filters infrastructure-damaged trajectories instead of treating tool failures as learning signal. The durable lesson is to preserve evidence across turns, score acquisition separately from interpretation, and classify trajectory validity before reinforcement updates; the paper, code, and benchmark assets were not independently inspected."
triggers: ["WeAgent-MMSearch", "VisTarget-Bench", "FA-GSPO", "fault-aware trajectory filtering", "multimodal search agent", "visual evidence provenance", "image retrieval evaluation", "6aaf9a2a000000002603036b", "6a9564b0000000000a009691"]
last_updated: "2026-09-26"
source_basis: "Full text of an official WeLM-team Xiaohongshu post and a later secondary XHS explanation by AI先声. The official post links arXiv:2608.28062, but the paper, code, and benchmark assets were not independently inspected in these XHS-specific reviews."
</ai_context>

# Multimodal search agents need separate retrieval and interpretation checks

Date: 2026-09-20  
Source: https://www.xiaohongshu.com/explore/6aaf9a2a000000002603036b  
Stable item ID: `6aaf9a2a000000002603036b`  
Author: WeLM技术团队  
Linked paper reported by source: https://arxiv.org/abs/2608.28062  
Tags: multimodal-search, visual-evidence, cross-turn-reasoning, retrieval-evaluation, agentic-rl

## Finding

A current post from the WeLM technical team introduces **WeAgent-MMSearch**, a multimodal search agent designed so that retrieved images continue to participate in reasoning across turns. The post says the system supports revisiting, reasoning over, and citing images to produce answers with both textual and visual evidence.

The more reusable signal is the accompanying evaluation split. The team says **VisTarget-Bench** contains 150 human-verified tasks intended to distinguish two bottlenecks:

1. whether the agent retrieved an image that contains the needed evidence; and
2. whether the agent correctly understood and used that visual evidence.

This distinction matters because an incorrect final answer does not identify which subsystem failed. Conversely, a correct answer can hide weak retrieval if the model guessed from text or prior knowledge. A useful multimodal-agent trace should therefore retain the retrieved image identity, the turn at which it entered context, the claim it supports, and the interpretation made from it. Evaluation can then score evidence acquisition and evidence use separately before folding them into end-to-end answer quality.

## Reported results

The post says automated data construction, supervised fine-tuning, and GSPO reinforcement learning produced an average score of **55.97% across eight benchmarks**, described as a **19.22% improvement over the model before post-training**. These numbers are author-reported claims from the XHS post. The post does not name the eight benchmarks, define whether the improvement is relative or percentage-point, provide per-benchmark results, or disclose variance in its text.

The same post links arXiv:2608.28062, but this source-specific run did not inspect the paper, benchmark questions, code, model artifacts, or evaluation protocol. The reported scores therefore should not be treated as independently verified or directly compared with other multimodal-agent systems.

## Follow-up: keep infrastructure failures out of the learning signal

A later secondary XHS explanation by AI先声 ([post `6a9564b0000000000a009691`](https://www.xiaohongshu.com/explore/6a9564b0000000000a009691)) adds implementation and ablation claims not present in the official post's readable text. It says the harness gives retrieved images persistent references so later turns can reopen and cite them, and combines web, image, reverse-image, and code tools.

More importantly, it describes **FA-GSPO** as distinguishing recoverable execution trouble from unusable trajectories. Local tool-parameter errors are first repaired; trajectories that remain usable can continue into training; unrecoverable samples are filtered. The post reports an eight-benchmark average of **36.75** for the base harness, **51.04** after supervised fine-tuning, and **55.97** after reinforcement learning. It also reports a comparison of ordinary GSPO at **51.10** versus FA-GSPO at **55.97**, with VisTarget-Bench moving from **9.78** to **30.22** in that comparison. These are secondary-source claims: Scout did not inspect the paper table needed to confirm conditions, denominators, or whether the configurations differ only in fault handling.

The reusable training lesson is narrower than the score claim. In long tool-using trajectories, an execution timeout, malformed call, context overflow, or exhausted interaction budget is not automatically evidence that the agent's reasoning policy was poor. Before computing a reinforcement update, the trainer should record the failure class, whether recovery changed the trajectory, what observations remained valid, and why a sample was retained or excluded. Otherwise infrastructure noise can be rewarded or punished as if it were model behavior. Filtering is not neutral either: exclusion rates and failure classes should be reported, because removing difficult or failure-prone runs can inflate the apparent policy score.

## Scout assessment

The durable design lesson is: **keep retrieved media as addressable evidence across turns, and evaluate finding the evidence separately from interpreting it**. For a production-grade implementation, each answer citation should resolve to a stable retrieved asset or crop, preserve retrieval and transformation provenance, and indicate which reasoning turn consumed it. A benchmark should include at least four observable outcomes—missed retrieval, retrieved-but-misread, correctly interpreted but unsupported answer, and fully supported answer—rather than collapsing them into one final-response score.
