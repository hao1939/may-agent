<ai_context>
summary: "Caliper is an emerging open-source harness for testing whether agent skills, MCP servers, and rules actually improve outcomes. Its useful distinction is to measure outcome reliability, component activation, interference from neighboring skills, and token/time cost separately, then compare the same tasks with the component ablated. This turns agent customization from prompt craftsmanship into an experimentally testable dependency, although current evidence is project-authored documentation rather than independent execution."
triggers: ["agent skills", "skill evaluation", "MCP evaluation", "ablation", "activation testing", "Caliper", "agent customization"]
last_updated: "2026-11-15"
source_basis: "Live GitHub Repository Search API discovery and complete README inspection of edonadei/caliper at commit 20e50dfdeec6e56b1f105650301fc55750f45b68. Scout did not install Caliper, run its bundled examples, inspect all implementation code, or independently reproduce the reported scores."
</ai_context>

# Agent customizations need ablation and activation evals

**Date:** 2026-11-15  
**Disposition:** new knowledge  
**Repo:** [edonadei/caliper](https://github.com/edonadei/caliper)  
**Reviewed revision:** [`20e50dfdeec6e56b1f105650301fc55750f45b68`](https://github.com/edonadei/caliper/commit/20e50dfdeec6e56b1f105650301fc55750f45b68)

## Question

How can teams tell whether an agent skill, MCP server, rule set, or plugin caused better behavior rather than merely being present during a successful run?

## Source observation

Caliper is an open-source evaluation harness that runs the same tasks repeatedly through real agent CLIs, currently documenting support for Claude Code, Codex, Pi, Hermes, Antigravity, and OpenCode. Each attempt receives a fresh home and empty working directory. Specs can combine LLM-judged expectations, local Python assertions, setup state, conversation history, forbidden-file constraints, and declarations of which skills should activate.

The project's most important design choice is causal comparison. `--ablate` reruns a spec without a named skill or MCP server, allowing a full run to be compared against a baseline with the candidate component removed. It separately reports raw single-run success rate, activation, tokens, and wall-clock time. Neighboring skills can be installed together to test routing competition, and `activates: []` can assert that an agent should remain silent on unrelated prompts.

Caliper also distinguishes local realism from portable measurement. By default it loads the user's existing skills, plugins, MCP servers, connectors, rules, and settings, so the run reflects the agent actually used on that machine. For cross-machine or cross-backend comparisons it recommends disabling user customizations and holding the judge model constant. Saved results record CLI versions and loaded customizations, and comparisons warn when environments or judges differ.

The README argues that raw success rate should be primary because `pass@k` can make unreliable behavior look stronger when retries are allowed. Infrastructure failures and judge errors are classified as unusable rather than counted as task failures. The harness also differentiates a broken evaluation pipeline from a cleanly run evaluation that fails its declared behavioral bar.

## Interpretation

The reusable signal is that agent configuration should be evaluated as a set of competing, costly dependencies rather than as undifferentiated context. Four questions need separate measurements:

1. **Outcome:** Did the task succeed repeatedly?
2. **Activation:** Did the intended component load, and did it stay quiet when irrelevant?
3. **Causality:** Did removing that component reduce quality or increase cost?
4. **Interference:** Did another skill, rule, connector, or judge change the result?

A skill that activates reliably but does not improve an ablated baseline is unnecessary context. A skill that improves task outcomes but steals prompts from a neighboring skill has a routing defect. A skill that raises pass@k while leaving single-run reliability low may be useful only when the surrounding system explicitly owns retries. These are different engineering decisions and should not collapse into one aggregate score.

## Reusable pattern

For consequential agent customizations:

- keep the behavioral spec beside the component;
- test multiple attempts and lead with single-run reliability;
- assert activation and non-activation separately from task success;
- run the same tasks with the component ablated before crediting it;
- include realistic neighboring components to expose routing collisions;
- use executable assertions for filesystem, JSON, command, and side-effect facts;
- pin or record the agent CLI, model, judge, loaded customizations, and source revisions;
- isolate user customizations for portable comparisons, but retain a separate realistic local profile;
- compare token and latency cost alongside behavioral gain;
- classify infrastructure and judge failures separately from genuine behavioral failures.

## Evidence boundary

This finding is based on live repository metadata and the complete project README at the reviewed revision. The example score improvements, isolation behavior, backend support, activation detection, and result classification are maintainer-authored claims. Scout did not install the package, authenticate any supported agent CLI, run the example suite, inspect all implementation code, or independently verify the reported measurements. The evidence supports a concrete evaluation design and active implementation, not independent proof that every backend is correctly isolated or scored.

## Discovery evidence

At `2026-11-15T04:03Z`, live GitHub Repository Search API calls returned HTTP 200 and surfaced `edonadei/caliper`, with 235 stars, 26 forks, and a push at `2026-11-15T03:52:23Z`. Star counts are discovery signals only. Search across the Scout library and daily digest found no existing Caliper record or finding centered on ablation plus activation testing for agent customizations.
