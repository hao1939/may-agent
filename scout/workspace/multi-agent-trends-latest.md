# Multi-Agent Coordination Frameworks Research (Latest)

## Context
Researching the latest multi-agent framework patterns surfacing on GitHub (as a proxy for broader community trends, including those that might cross over to XHS).

## Recent Highlights (Updated recently)

1. **claude-agents-framework** (https://github.com/hamilton-sky/claude-agents-framework)
   - **Pattern:** Role-based pipeline (8-agent).
   - **Key Mechanism:** "Files are the protocol." This is a significant finding. Instead of relying on complex message-passing APIs, they use behavioral contracts and the file system as the state/communication layer.
   - **Feedback:** Routing issues back automatically.
   - **Relevance to SOUL:** Highly relevant. Our framework already leans into files (markdown) as state and contracts. This validates that file-based coordination is a growing and effective pattern for agent orchestration.

2. **claude-code-conductor** (https://github.com/satoh-y-0323/claude-code-conductor)
   - **Pattern:** Orchestration-centric framework for Claude Code.
   - **Relevance:** Highlights the increasing need for "conductor" or orchestrator agents in multi-agent setups.

3. **cognio-rlaf** (https://github.com/youssef17amr/cognio-rlaf)
   - **Pattern:** Multi-perspective critic ensembles.
   - **Relevance:** Using multiple agents purely for *feedback/criticism* in training or execution loops.

## Core Insight for SOUL
The "Files are the protocol" concept seen in `claude-agents-framework` aligns perfectly with SOUL's use of markdown files (projects.md, knowledge.md) for state and coordination. We should double down on this pattern and perhaps formalize "behavioral contracts" in our agent definitions.
