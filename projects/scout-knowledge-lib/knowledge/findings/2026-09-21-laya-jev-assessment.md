<ai_context>
This note distinguishes the Convai Innovations Laya weights, the original Python implementation, and Receptron's independent Node/ONNX wrapper before comparing them with TypeSafe's hosted Jev service. Evidence labels separate direct observation, first-party documentation, and project claims. Recheck revisions, service terms, and task-specific quality before adoption: all reviewed releases were only days or weeks old on 2026-09-21.
</ai_context>

# Laya versus TypeSafe Jev: identity, local trial, and evidence limits

**Observed:** 2026-09-21 UTC  
**Question:** What are the authoritative Laya and Jev artifacts, can Laya's documented typed-decision features run safely in an isolated local setup, and does current evidence justify deeper experimentation for Hao/May?

## Bottom line

Laya is not one artifact. The model weights and Python package are published by **Convai Innovations**; an Apache-2.0 source repository is under the individual account `NandhaKishorM`; and `receptron/laya` is a separate MIT Node/TypeScript wrapper around a Receptron-published ONNX conversion. The wrapper reproduced its pinned reference output locally for Choice, Score, and Noul on CPU. It is genuinely inspectable and credential-free at inference time, but the reviewed projects were only two to three days old, the fp32 bundle occupied about 1.6 GiB, resident memory reached about 1.69 GiB in this trial, and the base model's own card reports weak zero-shot results on some workloads and the need for domain calibration.

Jev is TypeSafe's first hosted “System One” model, not the old Lightbend/Typesafe company or a public model repository. TypeSafe's own domain, documentation, and `typesafe-ai` GitHub organization establish this identity. Jev 1.13.0 exposes the same three primitives through a hosted API and supports much larger contexts and up to 255 Choice options, but its model weights, architecture, hardware, and license were not published in the reviewed authoritative materials. Testing Jev itself requires an account/API key and sends state to TypeSafe, so this credential-free task did **not** make a Jev inference call.

**Recommendation:** a bounded Laya evaluation on a labelled, non-sensitive May routing or triage corpus is justified only if there is a real candidate decision currently expensive enough to merit a model. Compare pinned Laya, pinned Jev, deterministic rules/no change, and—only if an existing approved LLM endpoint is available—the official System One adapter on identical cases. Do not adopt from the speed claims or this single functional example. Keep side effects and acceptance outside either model, fit thresholds on held-out data, and prefer no change when no measured bottleneck exists.

## Evidence levels

- **Observed:** command or response directly inspected in this assessment.
- **First-party claim:** documentation controlled by the artifact owner; useful but not independently reproduced here.
- **Third-party/project claim:** a comparison asserted by another project and not proof about the compared system.
- **Not established:** the reviewed evidence is insufficient.

## Identity and provenance

| Name | Authoritative identity and pinned material | Ownership / license | What it is | Maturity evidence observed |
|---|---|---|---|---|
| Laya model | [HF `convaiinnovations/laya`](https://huggingface.co/convaiinnovations/laya/tree/1c5edc17a7acd8701df6fc341c0d179f1c62c982), revision `1c5edc17a7acd8701df6fc341c0d179f1c62c982` | HF author `convaiinnovations`; model card tag and PyPI metadata say Apache-2.0 | Three checkpoints: 421M-parameter English ModernBERT-large plus decision head; 322M multilingual mmBERT; 421M typed-decisions fine-tune | HF last-modified 2026-09-20; API showed 0 downloads and 1,582 likes. These counters are volatile and not quality evidence. |
| Original Python source | [`NandhaKishorM/laya`](https://github.com/NandhaKishorM/laya/tree/42626c348753fbb17572a813127df2278a1ec527), revision `42626c348753fbb17572a813127df2278a1ec527` | Individual GitHub account; Apache-2.0 | Source linked by the Convai model card; PyPI `laya` 0.3.4 names Convai Innovations as author | Created 2026-09-18; pushed 2026-09-20; GitHub API showed 8,917 stars, 750 forks, 51 open issues. Very young despite rapid attention. |
| Receptron wrapper | [`receptron/laya`](https://github.com/receptron/laya/tree/6478649e723122ca24bbf5fb69ed1010023c9750), revision `6478649e723122ca24bbf5fb69ed1010023c9750`; npm `@receptron/laya` 0.1.2 | Receptron organization; MIT; model weights remain Apache-2.0 | Independent Node 20+ ONNX Runtime wrapper that implements the Python request/response shape | Created 2026-09-19; 0.1.2 released 2026-09-21; 130 stars, 11 forks, 0 open issues when observed. It is not Convai's model publisher. |
| Receptron ONNX bundle | [HF `receptron/laya-onnx`](https://huggingface.co/receptron/laya-onnx/tree/68f27dfe5a27a54fb2b1fefc432f43f972e90868), revision `68f27dfe5a27a54fb2b1fefc432f43f972e90868` | Receptron; HF tag says Apache-2.0 and declares `convaiinnovations/laya` as base model | fp32 ONNX conversion used in the local test | Last modified 2026-09-19; 0 downloads / 0 likes in API response. Conversion fidelity is asserted by the wrapper and checked for one fixture below, not comprehensively audited. |
| TypeSafe Jev | [TypeSafe introduction](https://docs.typesafe.ai/introduction), [models](https://docs.typesafe.ai/models), [launch post](https://typesafe.ai/blog/introducing-system-one-models-and-jev), observed official version `jev-1.13.0` | TypeSafe-controlled domains and [`typesafe-ai`](https://github.com/typesafe-ai) organization | Closed hosted text-in / typed-probability-out service with Choice, Score, and Noul | Launch post dated 2026-09-15 and calls Jev early access. Official JS/Python SDK repositories were created 2026-09-04; observed heads were `66880cc...` and `0ffd094...`, both MIT. SDK licenses do not license Jev's model. |

### Provenance limits

- **Observed:** the Convai HF card links `NandhaKishorM/laya`, while PyPI names Convai Innovations. The reviewed primary pages do not explain the legal relationship between the individual GitHub account and Convai Innovations.
- **Observed:** Receptron's README accurately links the Convai weights and labels itself a runner; no evidence says Receptron trained or owns the original model.
- **Not established:** Jev's parameter count, underlying encoder, serving hardware, training corpus, model-weight license, or downloadable weights. TypeSafe says it built a new architecture, parallel sampler, and RLCD training method, but does not disclose enough to reproduce the model.
- **Important naming boundary:** this TypeSafe is `typesafe.ai` / `github.com/typesafe-ai`, not the historical Typesafe/Lightbend Scala company. Searches of `typesafehub` and `lightbend` found no authoritative Jev repository; the owner-controlled TypeSafe pages did.

## Architecture and capabilities

### Laya

**First-party/project documentation:** the English checkpoint combines a fully fine-tuned ModernBERT-large encoder with a two-transformer-layer decision head. Every option is represented by a `[MASK]` marker and scored in parallel. The three question types are:

- **Choice:** selects one caller-defined option and returns a probability distribution.
- **Score:** returns an expected ordinal level and distribution over rubric levels.
- **Noul:** returns `P(true)` for a yes/no statement.

The English root has a 512-token total sequence and a 192-token question/options budget. The multilingual and typed-decisions variants default to 1,024 / 256. The model does not generate prose. The wrapper batches questions into one ONNX forward pass, serializes JSON state, applies the checkpoint's per-question/cardinality temperatures, and exposes the Python-compatible response shape.

**Limit disclosed by Laya's own card:** the base English and multilingual checkpoints were below a majority-class baseline on the card's typed-decisions evaluation; the reported 0.766 belongs to a checkpoint fine-tuned on that benchmark's training split. The card also reports poor default performance for a 77-label task, weak ordinal scoring, over-confidence before temperature fitting, and English-only behavior at the root checkpoint. “Cannot hallucinate” should therefore be read narrowly as “cannot emit an out-of-schema string,” not “cannot make an incorrect high-confidence decision.”

### Jev

**First-party documentation:** Jev evaluates a text/JSON state against Choice, Score, and Noul questions in parallel and returns typed values and probabilities; Choice and Score also return a derived confidence. Version 1.13.0 lists a 64k request context, with 32k for the state plus longest question, text-only input, 250,000 tokens/s and 1,200 requests/minute current limits, and `$0.042` per million input tokens. Aliases such as `jev-latest` can move; TypeSafe recommends pinning and logging the returned version when thresholds depend on behavior. TypeSafe says English is strongest and calibration is a group property, not a guarantee for one answer.

The API can accept up to 255 Choice options according to the launch post. The service is remote and its implementation is opaque; the “parallel” behavior and calibration are first-party claims, not locally inspectable architecture.

## Safe isolated local setup

### Instructions inspected before execution

I read the complete pinned Receptron README, `package.json`, MIT license, `src/download.ts`, `src/laya.ts`, all three test files, and the Convai model card/config before running setup. The wrapper requires Node 20+, downloads five files into a cache, uses ONNX Runtime CPU by default, and accepts an optional Hugging Face token only for private repos. Its default `revision: "main"` is mutable, so this run overrode it by downloading a pinned public revision directly.

### Environment and isolation

- Scratch root: `/tmp/scout-laya-jev-20260921` (outside the library and May repositories).
- OS: Linux x86_64 under WSL2; 16 logical CPUs, Intel Core i7-10700 @ 2.90 GHz (8 cores / 16 threads).
- Node `v24.21.0`, npm `11.19.0`, git `2.39.5`, Python `3.11.2`.
- No API credentials, production endpoints, May state, or private data used. Only public GitHub, npm, PyPI, Hugging Face, and TypeSafe documentation endpoints were contacted.
- Model pinned to Receptron ONNX revision `68f27dfe5a27a54fb2b1fefc432f43f972e90868`; wrapper pinned to Git revision `6478649e723122ca24bbf5fb69ed1010023c9750`.

### Commands and results

```bash
git clone --filter=blob:none https://github.com/receptron/laya.git /tmp/scout-laya-jev-20260921/laya
cd /tmp/scout-laya-jev-20260921/laya
git rev-parse HEAD
# 6478649e723122ca24bbf5fb69ed1010023c9750

NODE_ENV=development npm install --include=dev --ignore-scripts --no-audit --no-fund
NODE_ENV=development npm test
NODE_ENV=development npm run typecheck
NODE_ENV=development npm run lint
```

The first install inherited `NODE_ENV=production`, so npm omitted dev tools and `npm test` failed with `tsx: not found`. Explicit `NODE_ENV=development --include=dev` was the successful workaround. Unit result before weights: 10 passed, 0 failed, model test skipped. Typecheck passed. Lint exited successfully with 26 warnings and 0 errors; warnings included complexity, type assertions, and one regular-expression warning.

The five bundle files were downloaded from the pinned HF revision using `curl --fail` into `.part` files and renamed only after success. Recorded SHA-256 values:

```text
a874eb254b58b0fcb1e7ad56fbb188c29d64e08c9a46b689433e1f52c66dba1e  laya.onnx
487746363a8da57bcadb4345352997d22a0fb90d70aa22c6856668d023242aba  laya.onnx.data
5049005dc6ae3ca5e82cc7d85c421357d5c543817300c8e8c5281ddbc69bb561  laya_config.json
6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30  tokenizer/tokenizer.json
50044de60daaa73df97d262e15a40d4faf0160e7d742df64b377877a1320dd12  tokenizer/tokenizer_config.json
```

The bundle was about 1.6 GiB (`laya.onnx.data` advertised 1,685,258,240 bytes). With `LAYA_MODEL_DIR` pointed to it, all **11/11 tests passed**, including the end-to-end Python-reference fixture in 5.15 seconds.

### Cleanup

`node_modules` was removed after retaining command output; the complete owned scratch tree, including the 1.6 GiB model, was removed after the note captured hashes and results. No canonical library file, credential store, user cache, or production state was touched. A future reproduction must download the pinned bundle again.

## Hands-on feature observation

The end-to-end fixture used a synthetic refund ticket and exactly three documented primitives in one call. The pinned ONNX wrapper returned:

```json
{
  "model": "laya",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "billing",
      "probabilities": {"billing": 0.9415, "support": 0.031, "sales": 0.0275},
      "confidence": 0.7603
    },
    "urgency": {
      "type": "score",
      "score": 1.3886,
      "probabilities": {"0": 0.1752, "1": 0.2947, "2": 0.4962, "3": 0.0338},
      "confidence": 0.1867
    },
    "churn_risk": {"type": "noul", "noul": 0.0988}
  },
  "usage": {"input_tokens": 267, "output_tokens": 0}
}
```

This proves the pinned wrapper can load the bundle and emit all three shapes on this machine, and that it matches the checked-in Python fixture to four decimals. It does **not** prove semantic correctness: the low churn probability is arguably surprising for a ticket that explicitly threatens a bank dispute, which is a useful reminder that schema validity and calibrated-looking numbers are not decision quality.

Jev's documented quick-start shows the same three response shapes and resolves `jev-latest` to `jev-1.13.0`, but no live Jev output was observed because an API key was intentionally not supplied.

## Speed and benchmark claims, kept separate

| Claim / measurement | Hardware | Software / revision | Workload and batch | Warm-up / samples | Metric | Comparator and admissible conclusion |
|---|---|---|---|---|---|---|
| Convai model card: 39.5 ms for 1 question; 158.6 ms for 10; 771 ms for 50 | Tesla T4 GPU | Laya card at HF revision `1c5edc...`; checkpoint table includes English and multilingual | “byte-identical questions in same run”; exact prompts not in the table | Not stated | latency, apparently per call | No locally matched Jev run. Project's Jev numbers are explicitly third-party with different prompts/sample sizes, so they cannot prove “6–8× faster.” |
| Receptron README: about 140 ms for 3 questions | Unspecified Apple-silicon CPU | wrapper `6478649...`, ONNX fp32 | three questions in one call; exact benchmark prompt not specified | “once warm”; sample count/dispersion absent | wall latency | Useful capacity hint only; hardware and method are insufficient for comparison. |
| TypeSafe launch: 70–500 ms and 40–200× faster on System-One-shaped queries | Serving hardware not disclosed | Jev release context at launch; page does not bind every result to a version | Workloads vary; launch text says a showcased query is short/dense and favorable; higher-cardinality uses two stages | Not stated | end-to-end response time | Vendor claim. Compared LLM range is 3–329 s from a linked external benchmark, not this local Laya workload. No Laya-vs-Jev inference is warranted. |
| **Observed local:** 208.5 ms median, one Choice question | Intel i7-10700 CPU, Linux/WSL2, 16 logical CPUs | Node 24.21, ONNX Runtime installed as 1.30.0, wrapper `6478649...`, bundle `68f27df...` | same synthetic refund state, 1 question, batch size 1 | 1 discarded warm-up; 5 measured: 186.3–209.9 ms | wall-clock around `systemOne`; load excluded | Comparable only to reruns of this exact request/environment. |
| **Observed local:** 634.2 ms median, three mixed questions | same local CPU | same pinned software | same state; Choice + Score + Noul in one call, batch size 3 questions | 1 discarded warm-up; 5 measured: 554.3–658.2 ms | wall-clock; load excluded | Not comparable to Receptron's Apple figure or TypeSafe's remote service. |
| **Observed local load:** 1,877.5 ms; RSS 1,600.5 MiB after load, 1,693.6 MiB after runs | same local CPU | same pinned software | initial session creation | one observation | wall load time and Node RSS | Confirms substantial local footprint, not throughput. |

There is no honest speed winner from these data. A comparable test requires identical states/questions, pinned model versions, same client region and concurrency, a declared cold/warm policy, enough repetitions for percentiles, and cost/quality measured together. Laya CPU inference avoids network latency but uses local memory/compute; Jev includes remote transport and undisclosed serving hardware.

## Operational and security implications

### Laya local

- **Advantages:** no inference payload leaves the host after download; weights/source are inspectable; no runtime credential; version and hashes can be pinned; no per-token service charge.
- **Risks:** 1.6 GiB bundle and roughly 1.7 GiB observed RSS; native ONNX/tokenizer dependencies enlarge the supply-chain surface; model files are untrusted binary inputs to native runtime code; default wrapper download follows mutable `main`; first-use download can fail or change without pinning; cache freshness uses size rather than a content hash.
- **Controls:** mirror and hash a reviewed bundle, pin wrapper and dependency lock, run under a no-network/low-authority worker after acquisition, cap CPU/memory, treat model output as untrusted evidence, and keep deterministic authorization plus human review for consequential effects.

### Jev hosted

- **Advantages:** tiny local footprint, high published rate limits/context, official maintained SDKs, and no local model-serving burden.
- **Risks:** state and questions cross a third-party boundary; API-key custody and egress controls are required; aliases can move; availability/rate/price are service dependencies; model internals and weights are not inspectable; early-access behavior and limits can change.
- **Controls:** pin `jev-1.13.0`, use synthetic/non-sensitive trials first, redact/minimize state, bind credentials to a narrow service, log returned model version and request identity without secrets, verify current DPA/retention terms, and fail toward review rather than silently authorizing effects. TypeSafe says requests/responses are not used for training and offers enterprise ZDR; those remain contractual claims to confirm for the applicable account.

## Decision comparison

| Option | Capability | Performance evidence | Setup burden | Maturity / maintenance | Operational risk and license | Plausible May use |
|---|---|---|---|---|---|---|
| Pinned Laya via Receptron | Local Choice/Score/Noul; short context; base quality uneven; model-specific calibration needed | Functional run observed; local CPU timings above; no comparable Jev quality/speed test | High download/RAM, native runtime, model lifecycle | Extremely young model and wrapper, though active during observation | Apache-2.0 weights + MIT wrapper; local data boundary but supply-chain/resource risk | Candidate only for high-volume, low-consequence, labelled semantic triage where local processing matters |
| Pinned Jev 1.13.0 | Hosted typed decisions, 64k request context, high-cardinality Choice, no text generation | Vendor latency/quality claims and third-party studies exist; no live run here | Low local setup, but account/key/network required | Early access; official docs/SDKs active but only weeks old | Proprietary service/model terms; MIT SDKs; data egress and vendor dependency | Candidate when context/high-cardinality or low ops burden matters and approved data egress exists |
| Official [`system-one-adapter-python`](https://github.com/typesafe-ai/system-one-adapter-python/tree/adffc2eab300a4fa3c0e92252d4ffd6ceaa53700) | Same interface over OpenAI, Anthropic, or compatible LLMs; not Jev-equivalent calibration | No comparative measurement here | Open MIT adapter, but still needs a model/provider and usually credentials | Created 2026-08-08; active at observed revision | Adds generative-provider cost, latency, parsing, and data boundary; useful as a test double/comparator, not a simpler production model | A fair interface-level control only when May already has an approved endpoint |
| Deterministic rules / existing code | Exact, auditable policy for explicit signals; no fuzzy generalization | Usually negligible compute; semantic accuracy must still be measured | Lowest when decision boundary is explicit | Mature ordinary code/testing practices | No model license, egress, or calibration risk; rules can be brittle | Preferred baseline for hard safety/authorization gates and obvious routing fields |
| No change | Existing behavior | Current baseline must be measured | None | Known system | Avoids new dependencies and false confidence | Default when there is no observed latency/cost/quality bottleneck or labelled evaluation set |

The official adapter is the closest open interface-compatible alternative found in owner-controlled evidence, but it is not operationally simpler if it introduces a new LLM provider. Deterministic rules are the genuinely simpler alternative for explicit policies, though they are not a semantic model substitute.

## Suggested deeper experiment (only after a use case exists)

1. Freeze 100–500 representative, non-sensitive labelled cases and define the action/review cost matrix before running a model.
2. Pin Laya's wrapper, weights, hashes, and temperatures; pin Jev `1.13.0`; freeze question wording and state serialization.
3. Run deterministic rules/no change, Laya, Jev, and optionally the adapter on identical cases. Measure per-class accuracy, Brier score/ECE, abstention/review coverage, p50/p95 latency, cold start, peak RSS, egress, and cost.
4. Mutation-test the downstream mapping: a high model score must not bypass authorization, independent verification, or side-effect controls.
5. Admit a model only if its held-out benefit clears an explicit threshold and remains robust to paraphrase, long-state, ambiguous/no-match, and high-cardinality cases.

## Unresolved questions

- What legal/provenance relationship connects Convai Innovations and the `NandhaKishorM` repository, and who signs future releases?
- Are the Receptron ONNX assets reproducibly built from the exact Convai revision, and is there a published build attestation beyond the export script and one fixture?
- How do Laya's calibrated probabilities transfer to May's actual domain after pinning one checkpoint and temperature policy?
- What are Jev 1.13.0's architecture, parameter count, serving hardware, model license, retention defaults, and reproducible benchmark artifacts?
- How do both models behave on identical ambiguous, adversarial, long-context, and no-valid-option examples?

## Primary sources

- Convai Innovations Laya model/card and files: <https://huggingface.co/convaiinnovations/laya/tree/1c5edc17a7acd8701df6fc341c0d179f1c62c982>
- Original Laya source: <https://github.com/NandhaKishorM/laya/tree/42626c348753fbb17572a813127df2278a1ec527>
- Laya PyPI metadata: <https://pypi.org/project/laya/0.3.4/>
- Receptron wrapper: <https://github.com/receptron/laya/tree/6478649e723122ca24bbf5fb69ed1010023c9750>
- Receptron ONNX bundle: <https://huggingface.co/receptron/laya-onnx/tree/68f27dfe5a27a54fb2b1fefc432f43f972e90868>
- TypeSafe introduction: <https://docs.typesafe.ai/introduction>
- TypeSafe models/version/limits: <https://docs.typesafe.ai/models>
- TypeSafe API: <https://docs.typesafe.ai/api>
- TypeSafe legal/data-handling index: <https://docs.typesafe.ai/legal>
- TypeSafe launch post: <https://typesafe.ai/blog/introducing-system-one-models-and-jev>
- Official TypeSafe JS SDK: <https://github.com/typesafe-ai/typesafe-sdk-js/tree/66880ccded6cb642dc1809620c2b108c33730214>
- Official TypeSafe Python SDK: <https://github.com/typesafe-ai/typesafe-sdk-python/tree/0ffd094c72ed9445223060b24ffd7a56aa781fb4>
- Official open System One adapter: <https://github.com/typesafe-ai/system-one-adapter-python/tree/adffc2eab300a4fa3c0e92252d4ffd6ceaa53700>
