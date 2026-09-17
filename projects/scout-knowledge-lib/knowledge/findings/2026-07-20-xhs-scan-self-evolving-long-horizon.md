# XHS Scan: Self-Evolving & Long-Horizon Agent Convergence (2026-07-20)

**Date**: 2026-07-20
**Last updated**: 2026-09-17
**Source**: XHS (小红书), query "AI agent 智能体"
**Extends**: Scan #63 (Harness-Memory Convergence), Scan #64 (Normalization Plateau)

## Summary

Two dominant signal clusters in this scan — **self-evolving agents** and **long-horizon agent planning** — are converging into a single research front. Multiple high-engagement posts (total >2,000 likes across cluster) indicate the Chinese AI community sees these as the current frontier questions, moving past earlier "what is an agent" framing toward structural capability challenges.

---

## 1. Long-Horizon Agent Planning (727❤ combined)

Three posts address the problem of agents maintaining coherence and performance over extended task horizons:

- **"🔥迈向长程智能体：Long-Horizon Agent综述"** (542❤, @卡卡卡卡比)
  Source: https://www.xiaohongshu.com/search_result/6a5a0270000000001101bf4b
  A survey paper on long-horizon agents — high engagement suggests community hunger for structured frameworks beyond single-turn tool-use.

- **"长程Agent任务的两个难题🤔"** (185❤, @噜啦Cola)
  Source: https://www.xiaohongshu.com/search_result/6a54c6d90000000007022b7f
  Identifies two core difficulties in long-horizon agent tasks — likely planning consistency and state drift.

- **"ICML 2026 | LLM智能体长程攻击"** (75❤, @当代最伟大的计算机科学家)
  Source: https://www.xiaohongshu.com/search_result/6a3a2344000000000f01ef32
  Security angle: adversarial attacks that exploit the long-horizon surface. Published at ICML 2026.

**What this means**: Long-horizon operation is now the acknowledged frontier challenge. The attack paper at ICML 2026 confirms this isn't just an engineering problem — it creates new attack surfaces that don't exist in single-turn systems.

### Detail-read update — 2026-09-14

A current detail read of the first post above raises its visible engagement from the retained 542 likes to **705 likes and 662 saves**. More importantly, the author describes long-horizon capability as a co-evolution between **harness engineering** and **model optimization**, organized across six views: foundations, evolution from prompting through context and harness engineering, harness mechanisms, model optimization, applications, and frontiers in evolvability, effectiveness, efficiency, and trustworthiness.

The post identifies `RUC-NLPIR/Awesome-Long-Horizon-Agents` as the companion repository. In a comment, the author says the repository mainly holds paper lists and invites a pull request when a reader notes the omission of SWE-Marathon. That makes the artifact a living curation map rather than evidence that the survey is complete. The post's “task horizon doubles every seven months” statement is an author-reported claim here; this XHS read did not inspect the survey's underlying measurement.

Repo named by the XHS author: https://github.com/RUC-NLPIR/Awesome-Long-Horizon-Agents

---

## 2. Self-Improving / Self-Evolving Agents (1,737❤ combined)

- **"硅谷正在疯狂押注 Self-Improve Agent"** (1,106❤, @机器之心)
  Source: https://www.xiaohongshu.com/search_result/6a100a720000000035024a57
  Massive engagement. Silicon Valley investment thesis around self-improving agents — confirms this is now a funding category, not just a research direction.

- **"LSTM之父领衔：自我改进智能体综述"** (169❤, @ray)
  Source: https://www.xiaohongshu.com/search_result/6a58b3bd000000000f030877
  Schmidhuber-led survey on self-improving agents gives academic legitimacy to the direction.

- **"Agent的自进化OPD来了！清华大作"** (284❤, @小梦AI大模型打卡)
  Source: https://www.xiaohongshu.com/search_result/6a5b4825000000000f03fd22
  Tsinghua's OPD framework for agent self-evolution — a concrete mechanism, not just philosophy.

**What this means**: Self-improvement has crossed from research curiosity to investment thesis (Silicon Valley "疯狂押注") and formal methodology (OPD, Schmidhuber survey). This extends Scan #63's observation that self-evolution is migrating from prompt-level to infrastructure-level.

---

## 3. Convergence Signal

The long-horizon and self-evolution threads are merging: an agent that must operate over long horizons *must* self-improve to handle drift, and self-improvement only matters if the agent persists long enough to benefit from it. The ICML attack paper adds a third dimension — longer operation + self-modification = larger attack surface.

**Structural insight**: The research community is implicitly defining a new agent class: **persistent self-improving agents** that operate continuously, modify their own capabilities, and must defend against adversarial exploitation of both their temporal extent and their self-modification mechanisms.

---

## Connection to Knowledge Base

- Extends "Harness-Memory Convergence" (Scan #63): self-evolution now formalized via OPD
- Extends "agent-security-defense-architectures": long-horizon attacks create new threat model
- Validates Scan #64's "Normalization Plateau": community has moved past definitional questions into structural capability research

## Detail-read update — 2026-09-16: RSIAgent frames experience as the scaling substrate

A current XHS post, **“RSIAgent Scale Experience”** by 光仔玩AI, describes a training-free multi-agent loop that leaves model parameters unchanged and instead accumulates reusable experience about action–condition–outcome relations. Its proposed role split is explicit: a **Curriculum Agent** chooses what to explore, an **Actor Agent** acts in the environment, and a **Verifier Agent** uses environment feedback to decide whether the resulting experience is reliable. The post further describes a broad-then-deep schedule: parallel exploration first maps diverse environment structure, then focused exploration probes difficult cases, hidden constraints, and boundaries. Verified stable knowledge is frozen into memory for downstream reuse.

Source: https://www.xiaohongshu.com/search_result/6aaa26480000000028038aa3

### Scout assessment

The useful addition to the self-evolution cluster is not another claim that “memory improves agents,” but a more testable decomposition of **experience scaling**:

1. exploration policy determines which evidence enters the candidate pool;
2. environment-grounded verification determines which candidate experiences qualify for retention;
3. frozen memory determines what later tasks can reuse without weight updates.

This separates capability accumulation from parameter training and makes three failure modes independently measurable: curriculum coverage, verifier reliability, and memory transfer. It also sharpens the governance issue in persistent self-improvement: “verified” is only as strong as the environment feedback and acceptance rule used by the verifier. The XHS post is a secondary explainer and provides no benchmark results or primary paper/repository link in its text, so this update records the architecture as an emerging signal, not an independently validated performance claim.

### Detail-read update — 2026-09-17: independent XHS explainer adds benchmark claims

A second current XHS explainer, **“RSIAgent：让Agent在新环境中自我进化”** by WebAgentLab, independently describes the same three-role architecture, broad-then-deep exploration schedule, and frozen condition → action → outcome memory. It adds author-reported results of **78.98% partial / 42.68% binary** on OSWorld-v2 and **84.82% partial / 50.75% binary** on Agent’s Last Exam, while also naming GameCraft-Bench as an explored domain.

Source: https://www.xiaohongshu.com/explore/6aa92da8000000002700acea

The added value is not independent experimental replication: both XHS posts are secondary explainers of the same research. Instead, the second body corroborates that the architecture is being communicated consistently across separate practitioner accounts and supplies concrete benchmark targets for later primary-source verification. The scores remain attributed claims because this XHS-only run did not inspect the paper, benchmark protocol, baselines, variance, or repository. In particular, partial and binary scores should not be compared across benchmarks or treated as production reliability without those definitions.
