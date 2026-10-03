<ai_context>
summary: "KaliBench isolates natural-language-to-CLI translation from end-to-end cyber-agent behavior and scores tool selection, optional flags, and positional arguments separately. Author-reported results show that narrowing the candidate tools mostly fixes selection, while documentation produces much larger gains in argument correctness. Its runtime-free reward is deterministic only against a prevalidated reference command; it does not prove that a novel command is safe, semantically equivalent, or successful in a live environment."
triggers: ["KaliBench", "CLI tool evaluation", "runtime-free verifiable rewards", "argument construction", "tool-use benchmarks", "cybersecurity agents"]
last_updated: "2026-10-03"
source_basis: "Complete arXiv HTML paper v1 and current cs.AI feed metadata for arXiv:2610.02206. Scout did not inspect the repository or dataset, execute commands, reproduce experiments, or independently validate author-reported results."
</ai_context>

# Tool Selection and Argument Construction Need Separate Evaluation

**Date:** 2026-10-03  
**Source:** https://arxiv.org/abs/2610.02206v1  
**Primary text:** https://arxiv.org/html/2610.02206v1  
**Project:** https://risys-lab.github.io/KaliBench/  
**Repository:** https://github.com/RISys-Lab/KaliBench  
**Version reviewed:** arXiv v1, submitted 2026-10-01  
**Coverage:** complete HTML paper plus arXiv feed metadata; linked artifacts were not inspected

## Signal

*KaliBench: A Fine-Grained Benchmark for Cybersecurity Tool Use on Kali Linux with Runtime-Free Verifiable Rewards* evaluates one narrow but consequential agent boundary: translating a natural-language request into an exact CLI invocation. Rather than treating an end-to-end outcome as one score, it decomposes each command into the selected tool, alias-aware optional flag–value pairs, and ordered positional arguments. This makes a useful distinction between choosing **which capability** to invoke and constructing **how** to invoke it.

The benchmark contains 8,504 query–command pairs spanning 1,642 Kali Linux tools, 23 capability dimensions, and five security phases. Its 5,000-example evaluation split covers every tool; its 3,504-example training split covers 962 tools. The authors generated candidates from official tool manuals, then filtered them through LLM review, execution in a sandboxed Kali container, human review of suspicious model failures, and semantic deduplication. Only 30.7% of the initial 27,700 generated pairs remained.

Evaluation has three modes:

1. **Unrestricted:** only the request is supplied.
2. **Restricted:** the correct tool appears among 20 candidate tool names.
3. **Hinted:** documentation for those candidate tools is also supplied.

Across the tested open-weight configurations, moving from unrestricted to restricted raises mean tool accuracy from 72.0% to 95.2%, but yields only modest improvements in exact commands and argument metrics. Adding documentation has the larger effect: mean optional-argument F1 rises from 45.1% to 87.8%, positional-argument F1 from 61.1% to 90.1%, and exact-command accuracy from 22.3% to 73.1%. The authors' interpretation is that candidate restriction largely resolves tool selection, while documentation resolves missing command knowledge and argument construction.

## What “runtime-free verifiable reward” establishes

KaliBench parses generated shell syntax without executing model outputs and compares the decomposed command to a prevalidated reference. The reward combines tool, optional-argument, positional-argument, exact-match, and formatting scores. Because reference commands were checked during dataset construction, this creates repeatable component-level training signals without running each sampled output.

That is a narrower guarantee than the phrase *verifiable reward* can suggest. It verifies agreement with a recorded command structure, including documented aliases; it does not establish that an unseen but equivalent command is valid, that a command is safe for a particular target, or that it achieves the intended effect in a live environment. Runtime verification was used to curate the references, not to validate arbitrary model outputs at evaluation time.

The paper reports that post-training an 8B RedSage model with supervised fine-tuning plus GRPO raises its three-mode average Total Score to 79.2, 7.5 points above the base according to the abstract/summary, and places it within 1.0 point of the much larger DeepSeek-V3.2 configuration. The gains are not uniform: the GRPO variants slightly regress in hinted-mode Total Score, and the authors identify argument errors and regressions on previously solved examples.

## Operational implication

For agent evaluation, tool-call correctness should be measured at several layers rather than collapsed into one success flag:

- capability or tool selection;
- schema/grammar validity;
- argument names, bindings, values, and ordering;
- equivalence to one or more allowed plans;
- policy authorization and target safety; and
- observed effect in the real environment.

KaliBench supplies strong evidence for separating the first three layers. Its construction pipeline also demonstrates why generated evaluators need aggressive rejection and targeted human review: more than half of the initial generated commands contained invalid or hallucinated options on manual inspection, 11.95% of LLM-validated commands were removed by terminal checks, and another 4.9% were removed after human review of suspicious failures.

For a general agent runtime, a useful low-risk adaptation would be a component-wise evaluator over inert or sandboxed tools. Deterministic structural rewards could accelerate training and regression testing, but effectful execution should remain separately admitted, policy-checked, and observed. A reference-command match is evidence about syntax and expected arguments, not authority to execute.

## Limits

This is a new arXiv v1 and all benchmark and training results are author-reported. Scout did not inspect the released data or code, verify that all 1,642 tools and aliases are represented correctly, reproduce the sandbox filtering, or rerun any model. The test requests were synthesized from tool documentation rather than collected from analysts; the paper reports small degradation under informal language and a larger unrestricted-mode drop of 3.20 points in Total Score under deliberately messy queries.

The benchmark covers single-turn, single-command generation, not planning, stateful interaction, command sequences, recovery, environment interpretation, target authorization, or real-world effects. Exact-reference scoring can penalize semantically valid alternatives and cannot expose unsafe but syntactically correct actions. The authors release the research dataset under CC BY-NC 4.0 and describe responsible-use guidance, but cybersecurity commands are dual-use. The paper's safeguards and license are claims in the paper; Scout did not inspect their implementation in the repository.
