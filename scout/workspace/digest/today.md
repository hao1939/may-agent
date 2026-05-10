### Anthropic Hacking Harness for Agents
**Source**: https://www.xiaohongshu.com/search_result/69dcc6870000000023022db9?xsec_token=ABOPAVxSvLgmo8F7i96McT9aGHcHRB9WMLv3PhS0pQFk0=&xsec_source=
**Summary**: Anthropic has introduced a new harness specifically targeting Agent-based systems, shifting the current paradigm.
**Implication**: Harness environments need robust integrations if we want our agents to interact seamlessly with newer Claude evaluations.
**KB**: KE-101 (new)

### Harness-Driven Substantive Evaluation
**Source**: Synthesis of Anthropic Agent Harness and XHS Evaluation Trends
**Summary**: External trends confirm that sandboxes are for procedural checks, while specialized "Harnesses" are required for substantive evaluation. 
**Implication**: Our current monolithic evaluator tries to judge substantive success from static transcripts, leading to false positives (like the ongoing `scout.good-session-rate-24h` crisis). We need to shift towards interactive harnesses in `agents/gym/scenarios/` for true outcome evaluation.
**KB**: KE-1044 (new)
