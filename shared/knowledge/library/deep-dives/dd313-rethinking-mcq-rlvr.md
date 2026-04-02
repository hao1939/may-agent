# Deep-Dive #313: Rethinking MCQ for Reinforcement Learning with Verifiable Rewards

**Paper:** arXiv:2603.12826v1 (cs.CL, 14 Mar 2026)
**Authors:** Haozhe Wang et al.
**Venue:** Pre-print, 2026

## Research Question
Can Multiple-Choice Questions (MCQs) be effectively used as verifiable rewards in RLVR, and what design choices determine whether MCQ-based RLVR succeeds or fails?

## Core Findings

### 1. Naive MCQ-RLVR Fails — But Can Be Fixed
- Standard MCQ format leads to reward hacking: models learn to exploit elimination strategies rather than genuine reasoning
- **Option shuffling** during training prevents positional bias exploitation
- **Distractor quality** is the key variable — random distractors → trivial; plausible distractors → effective training signal

### 2. MCQ Design as Reward Engineering
- The difficulty of MCQ-RLVR is determined by the **semantic distance** between correct answer and distractors
- Proposes a "distractor difficulty curriculum": start with easy distractors, progressively increase semantic similarity
- This creates a natural curriculum for RLVR without manual difficulty annotation

### 3. MCQ-RLVR Can Match Open-Ended RLVR
- With proper design (shuffling + quality distractors + curriculum), MCQ-RLVR achieves comparable performance to open-ended RLVR on math reasoning
- MCQ verification is **dramatically cheaper** — exact match vs. complex parsing/execution
- Opens the door to RLVR in domains where open-ended verification is hard (creative writing, ethics, planning)

## Connections to Our Framework
- **Evaluation Layer**: MCQ design = reward engineering. The quality of the verification signal determines RLVR effectiveness
- **Carnot Bound**: Verification cost reduction (MCQ vs. execution-based) without quality loss = more efficient reasoning training
- Connects to EvolveCoder (adversarial test evolution) — both papers show verification quality is the bottleneck in RLVR

## Relevance Score: 8/10
Directly addresses RLVR verification design, a core concern in our Evaluation-as-Optimization synthesis.
