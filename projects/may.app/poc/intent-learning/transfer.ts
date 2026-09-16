/** Counterfactual: same fresh input, accepted preference visible versus withheld. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHarness } from "./host-fixture";

if (!process.argv.includes("--live") || !process.env.MAY_HOST_SOURCE)
  throw new Error(
    "Set MAY_HOST_SOURCE and pass --live for this bounded model trial",
  );
const root = mkdtempSync(join(tmpdir(), "may-intent-transfer-"));
console.log(JSON.stringify({ event: "trial-start", root }));
const fixture = await createHarness(process.env.MAY_HOST_SOURCE, root);
try {
  await fixture.turn({
    id: "language-preference",
    conversation: "preferences",
    text: "From now on, when I share research papers, explain the assessment in Chinese. Keep code-debugging and other conversations in English.",
  });
  assert.equal(fixture.book.read().preferences.length, 1);
  fixture.reopen();
  const text = "https://research.example.test/new-evaluation";
  const without = await fixture.turn({
    id: "without-memory",
    conversation: "fresh-without",
    text,
    omitPreferenceContext: true,
  });
  const withMemory = await fixture.turn({
    id: "with-memory",
    conversation: "fresh-with",
    text,
  });
  const language = /Chinese|Mandarin|中文|汉语/i;
  assert.equal(without.decision.followUp?.appId, "scout-knowledge-lib");
  assert.equal(withMemory.decision.followUp?.appId, "scout-knowledge-lib");
  assert.doesNotMatch(
    JSON.stringify(without.decision.followUp?.input),
    language,
  );
  assert.match(JSON.stringify(withMemory.decision.followUp?.input), language);
  assert.match(withMemory.decision.response ?? "", /[\u3400-\u9fff]/);
  const unrelated = await fixture.turn({
    id: "unrelated",
    conversation: "debugging",
    text: "What does HTTP 404 mean?",
  });
  assert.doesNotMatch(unrelated.decision.response ?? "", /[\u3400-\u9fff]/);
  assert.equal(unrelated.decision.followUp, undefined);
  assert.equal(fixture.book.read().revision, 1);
  const forget = await fixture.turn({
    id: "forget-language",
    conversation: "forget-language",
    text: "Forget the standing preference to explain research-paper assessments in Chinese.",
  });
  assert.equal(fixture.book.read().preferences.length, 0);
  assert.doesNotMatch(
    forget.decision.response ?? "",
    /turn.{0,20}accept|project(?:ion|ed)|stag(?:e|ed|ing)/i,
  );
  const summary = {
    status: "passed",
    checks: [
      "explicit preference saved",
      "same fresh input differs only when memory is supplied",
      "preference reaches Scout assignment",
      "unrelated English conversation stays outside scope",
      "forgetting removes the rule without exposing internal acceptance steps",
    ],
  };
  writeFileSync(join(root, "checks.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ event: "trial-complete", root, ...summary }));
} catch (error) {
  writeFileSync(
    join(root, "checks.json"),
    JSON.stringify({ status: "failed", error: String(error) }, null, 2),
  );
  console.error(
    JSON.stringify({ event: "trial-failed", root, error: String(error) }),
  );
  process.exitCode = 1;
} finally {
  fixture.close();
}
