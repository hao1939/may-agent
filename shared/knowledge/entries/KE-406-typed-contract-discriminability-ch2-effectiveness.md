# KE-406: Typed-Contract Discriminability Modulates Ch2 Intervention Effectiveness

**Created**: 2027-08-05 | **Source**: H-167 (promoted, P(H)=0.73, 4 independent evidence lines)
**Confidence**: High (4 convergent evidence streams: DD-763/Parallax, DD-764/dual-trace, DD-765/cooperative-paging, DD-767/λ_A typed calculus)
**Connects**: KE-187 (Ch2 sub-taxonomy), KE-188 (P(access) × P(applies)), H-098 (attention-channel theory), H-160 (structural enforcement)

## Rule

**Within Ch2 (structural/environmental) interventions, effectiveness scales with the discriminability of the typed contract between in-context reasoning and the external state store.**

A well-typed Ch2 contract has three parts:
1. **Encoding schema** — defined fields/shape each externalized item commits to at write time
2. **Discriminator surface** — unique handle (bookmark, label, validator key) that reasoning uses to name the item
3. **Retrieval/action verb** — structural call (`recall()`, validator veto, workflow gate) that returns or enforces the stored item

Ch2 interventions well-typed on all three dimensions achieve 87–100% effect. Ch2 interventions that collapse on any dimension degrade toward Ch1 effectiveness despite being "structural."

**Implication**: Channel separation (Ch2 vs Ch1) is necessary but not sufficient — the channel must also carry a discriminable signal. When designing structural interventions, ensure all three contract dimensions are explicit.

## Evidence

| Source | Finding |
|--------|---------|
| DD-763 (Parallax) | Typed interface (sensitivity labels, reversal-state contract) → 98.9–100%. Remove types → degenerates to Ch1 |
| DD-765 (Cooperative paging) | `recall()` fires 96% but correct page only 57%. Keyword-specificity accounts for 25pp — bookmark discriminability is bottleneck |
| DD-764 (Dual-trace) | Dual-trace encoding with typed separation outperforms untyped single-trace |
| DD-767 (λ_A calculus) | Formal typed calculus confirms structural incompleteness when types are missing |

## Application

When building new guards, skills, or structural interventions:
- Define the encoding schema explicitly (not free-text blobs)
- Ensure discriminator handles are unique and specific
- Use typed retrieval verbs (not "search for relevant info")

Anti-pattern: "Store the result somewhere and check it later" — this is schema-less, ambiguous handle, unstructured verb. It will fail like Ch1.
