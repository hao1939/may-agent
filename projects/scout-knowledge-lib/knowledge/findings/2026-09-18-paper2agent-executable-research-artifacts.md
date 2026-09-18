<ai_context>
summary: "Paper2Agent converts a paper and its code into a tested MCP server, but its Nature evaluation also exposes an important boundary: 74 of 100 computational-biology papers were successfully agentified, while missing code, artifacts, documentation, and resolvable environments blocked the rest. Agentifiability is therefore both a delivery mechanism and a reproducibility probe; passing generated execution tests supports faithful reuse, not the validity of open-ended scientific conclusions."
triggers: ["Paper2Agent", "executable research artifact", "paper agent", "agent-native science", "MCP reproducibility", "scientific agent evaluation", "agentifiability"]
source_basis: "Full Nature article (DOI 10.1038/s41586-026-11044-y), Paper2Agent GitHub README and repository metadata, and HN item 49748023."
</ai_context>

# Paper2Agent: executable papers turn reproducibility into an operational test

**Date observed**: 2026-09-18  
**Disposition**: new knowledge  
**Coverage**: Full open-access Nature article as rendered in HTML, the project's current GitHub README and repository metadata, and the HN submission metadata. Supplementary files and generated MCP implementations were not independently audited.

## Sources

- **Primary paper**: https://www.nature.com/articles/s41586-026-11044-y
- **DOI**: https://doi.org/10.1038/s41586-026-11044-y
- **Repository**: https://github.com/jmiao24/Paper2Agent
- **HN item**: https://news.ycombinator.com/item?id=49748023

## Question

What does converting papers into tool-using agents reveal about reliable agent construction and scientific reproducibility, beyond the headline that papers can become interactive?

## What the authors built

Paper2Agent is a multi-agent pipeline that ingests a manuscript, supplementary material, code, data, and tutorials; sets up the code environment; identifies useful functions; wraps them as Model Context Protocol (MCP) tools, resources, and prompts; and iteratively executes tests before deployment. Generated tools retain references to source code, and validated tool implementations are locked. A chat agent can then invoke the paper-specific MCP rather than improvising directly against a repository.

This is stronger than paper retrieval: the published method becomes a constrained executable interface. It also moves important work from query time to a reusable build-and-validation stage.

## Reported evidence

These numbers are author-reported rather than independently reproduced here:

- For the AlphaGenome case study, 22 generated tools passed automated validation. On 15 tutorial-derived and 15 novel queries across five runs, the paper reports 98.7% and 100.0% accuracy, versus 82.7% and 78.7% for Claude with direct repository access. On 30 open-ended researcher-style queries, it reports 82.7% versus 56.7% for Claude plus repository and 72.2% for Biomni.
- In an end-to-end sample of 100 computational-biology papers processed without manual cleanup, 74 were successfully agentified. Those successful runs proposed 599 tools, 593 of which passed automated validation. Failures were attributed mainly to missing executable code, missing data or model artifacts, dependency/environment failures, and non-generalizable scripts.
- On 300 tutorial-derived questions from that corpus, the paper reports 91.2% accuracy for Paper2Agent with Sonnet 4 versus 80.3% for Sonnet 4 with direct repository access. It also reports lower mean query cost and latency ($0.20 and 1.6 minutes versus $0.38 and 4.3 minutes).
- The article reports successful recovery across 12 deliberately damaged repository configurations and 100% rejection on a permuted out-of-scope benchmark. The paper also states that automated validation and its multi-agent design contributed to performance in ablations.

## Durable interpretation

### 1. Agentification is an executable reproducibility probe

The 74% success rate is at least as informative as the high downstream benchmark scores. A paper that cannot be converted because code, data, artifacts, documentation, or environments are incomplete is not merely inconvenient for an agent; it exposes a concrete reuse failure for humans too. “Can a clean process reconstruct and exercise the claimed method?” is an operational reproducibility check.

### 2. Compile-time specialization can beat query-time improvisation

Paper2Agent spends effort once to extract, test, annotate, and lock a narrow tool surface. The comparison with direct repository access suggests that a validated adapter can reduce repeated code discovery and execution errors. The reusable pattern is:

1. bind an agent to a specific source and repository revision;
2. derive a narrow executable interface;
3. validate it against source-grounded examples;
4. retain code references and build receipts;
5. reuse that interface for later queries.

This is a better reliability boundary than repeatedly granting a general agent an unconstrained repository and asking it to reconstruct usage from scratch.

### 3. Workflow order belongs in the interface

For Scanpy, the system encodes the correct preprocessing sequence as an MCP prompt inferred from the paper and code. This separates two concerns that generic agents often conflate: selecting a tool and respecting an ordered scientific procedure. A reliable scientific interface needs both typed actions and an explicit workflow contract.

### 4. Passing execution tests does not validate a scientific conclusion

The paper explicitly keeps open-ended scientific reasoning human-in-the-loop and warns that agreement with one reference answer measures faithful execution more readily than analytical validity. Generated tests can establish that a tool runs and reproduces selected examples; they do not establish that a novel interpretation is scientifically correct, that the source paper is sound, or that all relevant parameter regimes are covered.

A useful evidence ladder is therefore:

- environment reconstructs;
- generated tool executes;
- selected source result reproduces;
- novel query is answered consistently;
- scientific interpretation survives independent validation.

Receipts should state which rung they prove rather than collapsing all five into “reliable.”

## Limitations

- The authors built the system and selected the evaluation design; this review did not reproduce the benchmark or inspect all generated servers.
- The large-scale computational-biology corpus was retrospective, and successful agentification was defined by completion of the tool-extraction, execution, and automated-validation pipeline.
- High accuracy on tutorial-derived or single-reference questions may not transfer to contested or underdetermined scientific judgments.
- The conversion still depends on the completeness and correctness of upstream papers, repositories, dependencies, data, and model artifacts.
- The HN item had 2 points and no comments when checked, so the durable signal comes from the primary paper rather than community discussion.

## Relevance to agent systems

Paper2Agent supports a general design rule for high-stakes agent tooling: **convert broad source material into a narrow, source-bound, tested capability before runtime, and keep execution validity separate from domain truth**. It also suggests an actionable publication standard: papers intended for computational reuse should ship the inputs, environments, examples, and interfaces needed for independent agentification, not just prose and a repository link.
