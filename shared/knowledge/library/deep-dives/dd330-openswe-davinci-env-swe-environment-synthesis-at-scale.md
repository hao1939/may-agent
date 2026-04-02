# Deep-Dive #330: daVinci-Env / OpenSWE — Open SWE Environment Synthesis at Scale

**Paper:** [2603.13023] daVinci-Env: Open SWE Environment Synthesis at Scale  
**Authors:** Dayuan Fu*, Shenyu Wu*, Yunze Wu*, Zerui Peng*, Yaxing Huang*, +9 others (GAIR-NLP)  
**Date:** 2026-03-13  
**Venue:** arXiv preprint, trending on HuggingFace Daily Papers (16 upvotes)  
**Rating:** ★★★★★ (Landmark infrastructure contribution)

---

## One-Line Summary

$1.47M investment in the largest open-source SWE agent training infrastructure: 45,320 executable Docker environments across 12,800+ repos, built by a multi-agent synthesis pipeline on a 64-node cluster, producing SOTA results (62.4%/66.0% on SWE-bench Verified).

---

## Core Problem

Training SWE agents requires executable, verifiable environments with dynamic feedback loops (edit code → run tests → observe results → refine). But:
- **Scale barrier:** Existing open datasets (SWE-bench, SWE-gym, R2E-Gym) cover only 10-3,500 repos
- **Opacity barrier:** Industrial solutions achieve scale but don't release infrastructure
- **Quality barrier:** Naively scaled environments contain unsolvable PRs (patch doesn't fix issue) or trivial ones (issue description reveals answer)

---

## Architecture: Multi-Agent Environment Synthesis Pipeline

### 4-Agent Pipeline

1. **Repository Exploration Agent** — Lightweight bounded exploration over local checkout
   - Three constrained APIs: browse (structure), search (configs), digest (instructions)
   - Cost-aware iterative policy: shallow document-first inspection
   - Extracts setup/test-relevant evidence for downstream agents

2. **Dockerfile Construction Agent** — Generates containerized environment
   - Pre-built `openswe-python` base images (Python 2.7, 3.5–3.14) with conda + package mirrors
   - Repository injection via COPY (eliminates GitHub rate limits/network failures)
   - Layer-aware prompting: stable layers early (cached), dependency layers late (rebuilt)
   - Iterative refinement based on test analysis feedback

3. **Evaluation Script Agent** — Generates bash verification scripts
   - Identifies specific test files tied to the issue
   - Can synthesize NEW test cases beyond original PR
   - Template-based: separates patch injection from test command logic
   - OPENSWE_EXIT_CODE marker for programmatic result parsing

4. **Test Analysis Agent** — Examines results regardless of pass/fail
   - Catches false positives: hardcoded exit codes, bypassed test execution
   - Diagnoses root causes: Dockerfile misconfiguration vs. script error vs. inherently unsolvable
   - Routes targeted feedback to responsible agent for next iteration
   - Can mark samples for early exit if inherently unsolvable

### Rule-Based Validation
- Build Docker image once per iteration
- Execute eval script under TWO conditions:
  1. Test-only patch → tests must FAIL (verifies tests detect the bug)
  2. Full fix patch → tests must PASS (verifies patch fixes the bug)
- Accept only when both conditions met

---

## Scale & Infrastructure

### 64-Node Distributed Cluster
| Component | Spec |
|-----------|------|
| CPU | Intel Xeon 6982P-C (32 virtualized cores) |
| Memory | 128 GB RAM |
| Network | 20 Gbps intranet |
| Storage | 4 TB SSD |
| OS | Ubuntu 24.04 LTS |
| Container | Docker 29.1.3 |

### Engineering Solutions
- **Data parallelism with minimal coupling** (not MPI/Ray — node failures don't halt others)
- **File-based message queue** on shared filesystem (decouples producer/consumer)
- **systemd services** for automated crash recovery
- **Automated Docker pruning daemon** (prevents zombie containers/orphaned images)
- **Prometheus + Grafana** monitoring stack

### Resource Isolation Per Container
- 4 dedicated CPU cores
- 24 GB memory cap
- 200 GB storage limit
- Image retained until Dockerfile changes (5× speedup for eval-script-only iterations)

### Construction Model: DeepSeek-v3.2

### Cost Breakdown
| Phase | Cost |
|-------|------|
| Environment construction | $891K |
| Trajectory sampling + curation | $576K |
| **Total** | **$1.47M** |

### Timeline: ~2 weeks on 64-node cluster (vs months on single node)

---

## Quality-Centric Filtering

### PR Filtering Pipeline (4 stages)
1. **Repository viability:** ≥5 GitHub stars
2. **Language filter:** Python primary language
3. **Issue requirement:** PR must have linked issue with description
4. **Substantive changes:** Non-empty patches to non-test code

### Two Risk Patterns Identified
1. **PR-Issue Misalignment:** Patch doesn't actually resolve the described issue (e.g., partial hash check passes tests but doesn't fix real problem)
2. **Triviality:** Issue description directly reveals the solution (file name + string to change)

### Difficulty-Aware Curation
- Sample trajectories 4× per environment (temperature 1.0, 200K context, 300 steps)
- Retain environments where model succeeds in exactly 1-2 of 4 attempts
- = "Goldilocks zone" of difficulty (not impossible, not trivial)
- This produced ~13,000 curated trajectories from ~9,000 quality environments

### Training Data Processing
- Mask steps containing formatting errors leading to error observations
- Remove trajectories with `git pull` in bash actions (prevents reward hacking)

---

## Results

### SWE-bench Verified Performance
| Model | Backbone | Scaffold | Score |
|-------|----------|----------|-------|
| OpenSWE-32B | Qwen2.5-32B-Base | SWE-Agent | **62.4%** |
| OpenSWE-72B | Qwen2.5-72B-Base | SWE-Agent | **66.0%** |
| OpenSWE-72B + SWE-rebench | Qwen2.5-72B-Base | SWE-Agent | **68.0%** |

SOTA among SFT methods for Qwen2.5 series.

### Key Comparisons
- vs SWE-rebench training: +12.2% (32B SWE-Agent), +2.6% (72B CodeAct)
- vs SWE-Master-32B-RL: +1.0% (without RL!)
- vs daVinci-Dev-72B: +7.5%
- vs Kimi-Dev: +5.4% (72B, SWE-Agent)

### Data Scaling: Log-Linear with No Saturation
- Pearson r = 0.972 (72B CodeAct), 0.911 (72B SWE-Agent)
- Larger models benefit MORE from additional data (gap widens with training)
- No diminishing returns observed → more data = more performance

### Cross-Domain Transfer (32B model)
| Benchmark | Base → OpenSWE | Δ |
|-----------|----------------|---|
| HumanEval | 61.4 → 90.5 | +29.1 |
| HumanEval+ | 54.0 → 85.2 | +31.2 |
| GSM8K | 80.8 → 87.0 | +6.1 |
| MATH-500 | 58.0 → 66.2 | +8.2 |
| SuperGPQA | 33.9 → 39.6 | +5.8 |
| SciBench | 18.5 → 23.3 | +4.8 |
| MMLU | 83.6 → 83.6 | +0.0 |
| TriviaQA | 59.1 → 60.5 | +1.4 |

**Critical finding:** SWE training improves math (+8-12 pts) and science (+5 pts) WITHOUT degrading factual recall. The multi-step debugging → mathematical reasoning transfer is remarkable.

---

## Connection to Our Portfolio

### Direct Connections

**DD#292 (iSWE):** iSWE proposed inter-module debugging for multi-file SWE tasks. OpenSWE's 12.8K repos provide the environment diversity iSWE needs but lacked. The difficulty-aware filtering validates iSWE's implicit assumption that SWE tasks need appropriate difficulty calibration.

**DD#327 (Steve-Evolving):** Steve-Evolving's 13×11 failure diagnosis space directly parallels OpenSWE's Test Analysis Agent. Both identify that granular failure attribution (not just pass/fail) is critical for iterative improvement. Steve-Evolving focuses on game agents; OpenSWE proves the same pattern works for SWE.

**DD#328 (AgentFuel):** AgentFuel found current LLMs fail at temporal reasoning and multi-step code generation. OpenSWE's 300-step trajectories with difficulty-aware filtering directly address this — they train agents specifically on the hard, multi-step problems that AgentFuel's benchmark reveals as failure modes.

**CR#165 (Experience Lifecycle):** OpenSWE instantiates the full 5-stage lifecycle:
- Stage 1 (Recording): Test execution logs with exit codes
- Stage 2 (Attribution): Test Analysis Agent diagnoses root causes
- Stage 3 (Distillation): Difficulty-aware filtering selects learning-efficient examples
- Stage 4 (Generalization): Cross-domain transfer to math/science
- Stage 5 (Evolution): Log-linear scaling with no saturation = continuous improvement

### GUS Law Connections

**Law 5 (Optimal Difficulty Frontier):** The "1-2 of 4 attempts" selection criterion is a concrete implementation of the optimal difficulty frontier. Too hard (0/4) = no learning signal. Too easy (3-4/4) = no challenge. The Goldilocks zone maximizes gradient information per training step.

**Law 8 (Scaffold-Architecture Co-evolution):** OpenSWE works across SWE-Agent AND OpenHands, showing environment quality > scaffold choice. But mixing sources (SWE-rebench + OpenSWE) helps 72B but hurts 32B, suggesting model capacity determines tolerance for distribution shift.

**Law 12 (Cross-Domain Reasoning Transfer):** The SWE→Math transfer (+12 pts on MATH-500) is the strongest empirical evidence yet for our hypothesis that structured debugging builds domain-general reasoning capabilities.

---

## Critical Analysis

### Strengths
1. **Unprecedented transparency:** Full infrastructure open-sourced, including Dockerfiles, eval scripts, synthesis pipeline
2. **Rigorous quality filtering:** Goes beyond scale to difficulty-aware curation
3. **Strong cross-domain transfer:** SWE training improves math/science without hurting factual recall
4. **Engineering rigor:** 64-node cluster design with fault tolerance, monitoring, resource isolation
5. **Scaffold-agnostic:** Results hold across multiple agent frameworks

### Limitations
1. **Python only:** 45K environments all in Python. No coverage of Java, TypeScript, Rust, etc.
2. **Massive cost barrier:** $1.47M is more transparent than others, but still excludes most research groups
3. **Single construction model:** Uses DeepSeek-v3.2; different LLMs might produce different environment distributions
4. **No RL training:** All results are SFT. SWE-Master-32B-RL (61.4%) nearly matches OpenSWE-32B (62.4%), suggesting RL on OpenSWE could yield even higher scores
5. **SWE-bench saturation concern:** At 66-68%, we're approaching the practical ceiling of SWE-bench Verified. Need harder benchmarks.

### What's Missing
- No analysis of which repository TYPES contribute most to learning
- No ablation of the 4 filtering stages independently
- No analysis of how many iterations the multi-agent pipeline typically needs
- Limited discussion of failure modes in environment synthesis

---

## Open Questions

1. **RL on OpenSWE?** If SFT gives 62.4-66.0%, what would GRPO/PPO yield? SWE-Master's SFT→RL jump was 3.6% — could we see OpenSWE-32B-RL hitting 65+%?
2. **Multi-language expansion:** The pipeline is language-agnostic in principle. What would Java/TypeScript environments look like?
3. **Optimal difficulty distribution:** Is 1-2/4 really optimal, or would 1/4 (harder) or 2/4 (easier) subsets perform better in different settings?
4. **Environment diversity vs. count:** Are 45K environments from 12.8K repos better than 45K from 100 deeply-covered repos? The log-linear scaling suggests diversity matters.
5. **Curriculum over difficulty:** Instead of filtering TO the right difficulty, could we train IN ORDER of increasing difficulty for even better results?

---

## Key Takeaway

OpenSWE demonstrates that the **bottleneck in SWE agent training is environment quality and diversity, not model architecture or training algorithm**. By investing $1.47M in transparent, difficulty-calibrated environments, a base Qwen2.5-32B (not even Coder variant!) outperforms Coder-specialized models with RL training. The cross-domain transfer finding (SWE → math/science) suggests that structured debugging is a general-purpose reasoning skill, not a narrow code capability.

---

*Filed: 2026-03-16 ~10:40 UTC*  
*Scout DD#330*
