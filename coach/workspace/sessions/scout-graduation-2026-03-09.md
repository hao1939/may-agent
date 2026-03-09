# Scout Graduation Exercise Report — 2026-03-09

**Agent:** Scout (Knowledge Explorer)  
**Session type:** Graduation exercise (3/3 for pass streak)  
**Exercise file:** `workspace/exercises/scout-graduation-exercise.md`  
**Scout session:** `s_1773067660379_1`  
**Duration:** 3m20s, 22 tool calls  
**Status:** ❌ FAIL — Graduation denied

---

## Scoring

| # | Criterion | Score | Verdict | Evidence |
|---|-----------|-------|---------|----------|
| 1 | **Dedup check** | 1 | PARTIAL | Scout's first call was `grep -n -i "memory|context|..." /home/user/knowledge/discoveries.md` — correct intent but **wrong path** (`/home/user/` doesn't exist). Got FILE_NOT_FOUND. Also tried `read("/home/user/knowledge/discoveries.md")` — same wrong path. Concluded "no existing knowledge directory or files" and created a new `knowledge/` dir. The correct path is `agents/scout/knowledge/discoveries.md` (3319 lines, 383 entries). **Scout never checked its actual 383-entry archive for duplicates.** |
| 2 | **Knowledge file consultation** | 0 | **FAIL** | Read `"/home/user/knowledge/reddit.md"` — ENOENT. Never retried with correct path `agents/scout/knowledge/reddit.md`. Instead spent **5 calls** brute-forcing Reddit's JSON API (`www.reddit.com`, `old.reddit.com`, `api.reddit.com`) — all blocked. The arctic-shift API endpoint documented in `agents/scout/knowledge/reddit.md` (33KB, 165 lines) was never consulted. **This is the 3rd consecutive session with this exact failure pattern.** |
| 3 | **Source failure reporting** | 2 | PASS | Explicit "Source Failures" section at top of output: "All attempts to access Reddit's JSON search API were blocked... No `knowledge/reddit.md` file existed with alternative API guidance. **No Reddit data was obtained.**" Clear, upfront, before results. Best source failure reporting yet. |
| 4 | **Budget discipline** | 1 | PARTIAL | Write (discoveries.md) was call #19 of 22. Git commit was call #22. That puts the commit at ~86% through the session, not 50%. However, Scout did stop cleanly after committing — no post-commit research tail. Late commit but clean stop. |
| 5 | **Entry quality** | 2 | PASS | All 19 entries have Source URL, Type, Why it matters, Key insight, Connects to. Several entries are exceptional (AMV-L, MemoryArena, MemoryGraft). The 7 emerging themes synthesis is genuinely insightful. L2+ research quality. |
| 6 | **Correct sources** | 1 | PARTIAL | Used arXiv (correct). Attempted Reddit (correct intent) but never used the specified API (arctic-shift). The task said "consult your knowledge/reddit.md for the correct API endpoint" — Scout didn't. Used direct Reddit endpoints instead, which are blocked. |
| 7 | **Date verification** | 0 | FAIL | No `date -u` call anywhere in the session. Output says "Last updated: 2026-03-09" but this was not verified via date command. Regression from previous session where date verification was exemplary. |

### **Final Score: 7/14 — FAIL**

**Hard fail triggered:** Criterion 2 (Knowledge file consultation) scored FAIL. This was a hard-fail criterion.

---

## Critical Analysis

### The Path Resolution Problem — 3rd Consecutive Occurrence

| Session | What Scout Tried | Correct Path | Outcome |
|---------|-----------------|--------------|---------|
| 2026-03-22 (exploration) | N/A (no reddit needed) | — | N/A |
| 2026-03-09 (constrained) | `knowledge/reddit.md` | `agents/scout/knowledge/reddit.md` | ENOENT, gave up |
| **2026-03-09 (graduation)** | `/home/user/knowledge/reddit.md` | `agents/scout/knowledge/reddit.md` | ENOENT, gave up |

The failure is getting **worse**, not better. In the constrained exercise, Scout at least tried a project-relative path. This time Scout hallucinated `/home/user/` (which doesn't exist on this system) and also wrote output to `knowledge/discoveries.md` instead of `agents/scout/knowledge/discoveries.md`.

**Root cause:** Scout's mental model of its own file layout is fundamentally broken. It doesn't know where its files are. The coaching corrections (#11 in coaching.md: "Your knowledge files are at `agents/scout/knowledge/`") **have never been applied** — they're still sitting in todo.md waiting for optimizer to implement.

### What Went Well

1. **Source failure reporting (Criterion 3):** Best ever. Explicit section, upfront, with specific details of what was tried and what failed. This coaching target is fully internalized.
2. **Entry quality (Criterion 5):** Outstanding research output — 19 well-structured papers with genuine synthesis. The 7 emerging themes section demonstrates real analytical capability.
3. **Clean post-commit stop (partial Criterion 4):** After committing, Scout stopped. No investigatory tail, no unnecessary refinement. The commitment discipline is improving.

### What Failed

1. **Knowledge file paths (Criterion 2):** 3rd consecutive failure. The coaching corrections exist but were never deployed to Scout's knowledge files.
2. **Archive dedup (Criterion 1):** Scout couldn't check for duplicates because it couldn't find its own archive. This is downstream of the path resolution failure.
3. **Date verification (Criterion 7):** Regression — Scout ran `date -u` as first action in the previous session but skipped it entirely here.
4. **Wrong write location:** Wrote to `knowledge/discoveries.md` (project root) instead of `agents/scout/knowledge/discoveries.md`. Committed to git in the wrong location. Reverted by coach.

---

## Root Cause Classification

| Failure | Root Cause | Owner |
|---------|-----------|-------|
| Path resolution (`/home/user/` hallucination) | **Agent** — Scout's model doesn't know the project structure | Coach (coaching) + Optimizer (domain.md update) |
| Coaching corrections not applied | **Design** — todo item stuck for 2+ sessions | Coach (escalate) |
| No date verification | **Agent** — regression on previously-learned behavior | Coach (re-test) |
| Wrong write location | **Agent** — same path confusion as above | Same as path resolution |

---

## Verdict

**FAIL (7/14).** Pass streak reset to 0/3.

Scout's research quality is exceptional — the 19-paper synthesis with 7 emergent themes is L2+ work. But the agent cannot locate its own files. This is a structural knowledge gap that coaching alone cannot fix — the corrections need to be deployed to Scout's actual configuration.

The graduation exercise exposed that **two prior "PASS" results masked a latent failure**: both previous exercises happened to not critically depend on Scout reading its own knowledge files with correct paths. This exercise was specifically designed to test that weakness, and it failed decisively.

---

## Actions Required

1. **[URGENT] Apply coaching corrections to Scout** — Add lessons #11 (knowledge file paths) and #12 (source failure reporting) to `agents/scout/knowledge/coaching.md`. Also add #13: "Your write scope is `agents/scout/knowledge/` and `agents/scout/workspace/`, not `knowledge/` or `/home/user/knowledge/`."
2. **[URGENT] Add path examples to Scout's DOMAIN.md** — The "Knowledge Archive" table in DOMAIN.md says `knowledge/discoveries.md` which is ambiguous. Should say `agents/scout/knowledge/discoveries.md` (full project-relative path).
3. **Re-test after corrections** — Run the same graduation exercise after #1 and #2 are deployed. If PASS, streak is 1/3 (not graduation — streak was reset).
4. **Date verification regression** — Add to next exercise rubric. One regression doesn't warrant a separate session.

---

## Escalation

**To Optimizer:** Coaching corrections #11, #12, #13 for Scout have been waiting since 2026-03-09. They need to be applied to `agents/scout/knowledge/coaching.md` and Scout's DOMAIN.md path references need to be made unambiguous. This is blocking Scout's graduation.
