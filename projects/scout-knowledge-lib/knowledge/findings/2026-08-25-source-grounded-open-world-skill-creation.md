<ai_context>
summary: "SkillAlchemy frames open-world skill authoring as two separate evidence problems: discover behavior-changing requirements omitted by a brief, then admit each source-derived procedure only at its supported scope. On 87 SkillsBench tasks across four agent-model configurations it reported 55.8% avg@5, versus 35.9% with no skill and 47.2% for the strongest automated baseline; small source-perturbation tests also suggest that retaining conflicts as evidence instead of copying them into runtime instructions can reduce contamination. The reusable pattern is contrastive discovery plus scoped admission, not unrestricted web synthesis."
triggers: ["open-world skill creation", "source-grounded skills", "implicit requirement discovery", "procedure admission", "SkillAlchemy", "SkillsBench", "contrastive evidence", "scope-aware instructions", "skill authoring"]
last_updated: "2026-08-25"
source_basis: "arXiv:2608.23417v1 (Wang, Wei, Liu, Yang, Tong), including the Atom record, full arXiv HTML, and PDF retrieved with bounded timeouts on 2026-08-25."
</ai_context>

# Discover missing requirements before compiling sources into skills

**Date:** 2026-08-25  
**Source:** https://arxiv.org/abs/2608.23417  
**Primary text:** https://arxiv.org/html/2608.23417  
**PDF:** https://arxiv.org/pdf/2608.23417

## Signal

SkillAlchemy isolates two failure modes that ordinary web-grounded skill generation conflates. First, an underspecified brief often omits conditions that change what a procedure should do. Second, a source can support a local action without licensing that action as a general runtime rule. More retrieval does not solve either problem by itself: in the authors' preliminary comparison, adding web access improved two conventional creators by 6.9 percentage points over their no-web versions, but the stronger web-enabled creator still trailed human-curated skills by about 14 points.

The proposed pipeline keeps discovery and admission separate:

1. **Operational framing** converts instance values into candidate factors rather than hard-coded instructions.
2. **Contrastive acquisition** probes matched contexts that differ along one substitution, boundary, or neighboring-capability factor. A factor becomes an implicit requirement only when evidence shows that it changes a condition, action, recovery path, or verification step.
3. **Decision-aligned induction** groups evidence by the procedural decision it informs, preserving operating conditions and conflicts rather than organizing notes only by source topic.
4. **Scope-aware admission** classifies a candidate as general, scoped, or excluded. Every specified component needs support; unresolved overlapping conflicts block admission; and a procedure is reusable only when a source states broader applicability or compatible evidence spans non-equivalent contexts.
5. **Compilation** renders the admitted procedures into a skill package with explicit triggers, boundaries, checks, and supporting references.

The important distinction is between an observation and an instruction. A retrieved statement first remains evidence with provenance and context. It becomes runtime guidance only after its applicability has been justified.

## Reported evidence

The study evaluates all 87 SkillsBench v1.1 tasks across eight domains, five downstream runs per task, and four combinations of Claude Code or Codex with three models. Evaluation assets—including held-out inputs, oracle artifacts, verifier code, and human-curated skills—were excluded from skill creation, and SkillsBench-related pages were excluded from web retrieval.

Pooled across 1,740 binary outcomes per condition, the paper reports:

- **55.8% avg@5** for SkillAlchemy, versus **35.9%** with no skill;
- **47.2%** for MUSE-Autoskill, the strongest automated baseline;
- **54.4%** for human-curated skills;
- a 95% Wilson interval of **[53.5, 58.1]** for SkillAlchemy and **[52.0, 56.7]** for human-curated skills.

The 1.4-point observed lead over human curation is descriptive, not evidence of superiority; the paper says the pooled intervals do not provide a pairwise test. Component ablations on three domains reduced avg@5 by 5.0–15.7 points, although those ablations are broad subsystem removals rather than clean tests of individual mechanisms.

A small contamination experiment injected one irrelevant, conflicting, or adversarial document into each of four task contexts. The four baseline creators promoted 5/16 irrelevant, 9/16 conflicting, and 4/16 adversarial payloads into affirmative runtime instructions. SkillAlchemy promoted 0/4 in each category and retained 17–18 downstream passes out of 20 across the perturbations. This is useful mechanism evidence, but only for 12 pre-specified injected payloads across four tasks.

## Design implication: maintain an evidence-to-instruction boundary

A source-grounded skill builder should persist at least three different artifacts:

- a **requirement map** of tested factors, matched contexts, unresolved contrasts, and affected procedure components;
- an **admission ledger** binding each candidate action, recovery step, and check to supporting and conflicting evidence plus its maximum justified scope;
- a **compiled runtime package** containing only admitted guidance, while keeping narrow examples and unresolved claims out of the general instruction path.

This changes search strategy. Instead of asking only “how do I perform this task?”, ask paired questions: when does this method stop applying, what sibling case needs different treatment, what failure changes recovery, and what output property proves success? Negative or conflicting evidence is not noise to summarize away; it is what prevents a local recipe from becoming a universal rule.

The pattern also complements skill activation controls already covered in the library. Admission before activation governs whether an existing skill revision may enter a harness. SkillAlchemy moves the boundary earlier: it governs whether a source-derived claim may become part of the skill at all. A safe lifecycle needs both content admission during authoring and behavioral admission before deployment.

## Boundary of the evidence

This is an arXiv v1 evaluated in one benchmark ecosystem. The four configurations reuse two agent runtimes and three model families, and pooled binary runs are not necessarily independent task-level evidence. The authors reproduce several baselines rather than using every original system implementation, and creation costs are substantial: in the reported Codex–GPT-5.5 setting, SkillAlchemy averages 23.21 minutes per task and 69.1K tokens per creation call. Domain behavior is uneven; Media remains a substantial deficit because generated skills often omit calibrated details at failure-prone stages.

The perturbation study is especially small, and testing known injected claims does not establish resistance to adaptive prompt injection, compromised sources, or mutually reinforcing misinformation. Scope records are produced by model-mediated research and can themselves be wrong. The durable conclusion is therefore architectural rather than universal: **open-world material should remain contextual evidence until contrastive discovery and explicit scope admission justify promoting it into executable guidance.**
