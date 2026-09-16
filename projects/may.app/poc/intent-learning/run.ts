/** Opt-in model trial. All conversation state, preferences, and research are synthetic. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHarness } from "./host-fixture";

if (!process.argv.includes("--live"))
  throw new Error("Pass --live to run the bounded model trial");
const host = process.env.MAY_HOST_SOURCE;
if (!host)
  throw new Error("MAY_HOST_SOURCE must identify the Host source checkout");
const root = mkdtempSync(join(tmpdir(), "may-intent-learning-"));
console.log(JSON.stringify({ event: "trial-start", root }));
const fixture = await createHarness(host, root);
const checks: { name: string; passed: boolean }[] = [];
function check(name: string, assertion: () => void) {
  assertion();
  checks.push({ name, passed: true });
  console.log(JSON.stringify({ event: "check", name, passed: true }));
}
try {
  const first = await fixture.turn({
    id: "link-1",
    conversation: "research",
    text: "https://papers.example.test/controlled-memory",
  });
  const delegated = first.decision.followUp!;
  check(
    "bare paper outside Scout context delegates research and archive",
    () => {
      assert.equal(delegated?.appId, "scout-knowledge-lib");
      assert.match(JSON.stringify(delegated.input), /archiv/i);
      assert.ok(delegated.requestId);
    },
  );
  const taskId = first.settled.admittedTasks[0].taskId as string;
  const initialRequest = fixture.readRequest("research", delegated.requestId!);
  const correction = await fixture.turn({
    id: "correction-1",
    conversation: "research",
    text: "Focus on whether its experiments actually support the conclusion. Keep the assessment in the archive.",
    focus: { appId: "scout-knowledge-lib", taskId },
  });
  check(
    "one-time correction keeps Task and Request identity without permanent memory",
    () => {
      assert.equal(correction.decision.followUp?.task?.taskId, taskId);
      assert.equal(
        correction.decision.followUp?.requestId,
        delegated.requestId,
      );
      assert.equal(correction.settled.admittedTasks[0].taskId, taskId);
      assert.ok(
        fixture.readRequest("research", delegated.requestId!).revision >
          initialRequest.revision,
      );
      assert.equal(fixture.book.read().preferences.length, 0);
    },
  );
  fixture.reopen();
  check("corrected Request survives storage reopen", () => {
    const request = fixture.readRequest("research", delegated.requestId!);
    assert.equal(request.status, "open");
    assert.match(request.scope, /experiment|evidence|conclusion/i);
    assert.ok(fixture.readTask(taskId));
  });
  const research = await fixture.research(taskId);
  check("Scout saves verified evidence with the confounding limitation", () => {
    assert.equal(research.settled.status, "applied");
    const archive = readFileSync(research.output.archivePath, "utf8");
    assert.match(archive, /confound/i);
    assert.match(archive, /58%/);
    assert.match(archive, /71%/);
    assert.match(archive, /Coverage: full_text/);
  });
  const returned = await fixture.turn({
    id: "result-1",
    conversation: "research",
    sourceKind: "app",
    text: `The linked Scout Task returned an accepted result. Judge it against the current Request and respond if useful. ${JSON.stringify(research.output)}`,
    focus: { appId: "scout-knowledge-lib", taskId },
  });
  check(
    "May returns the archived result and fulfills the latest Request",
    () => {
      assert.equal(
        fixture.readRequest("research", delegated.requestId!).status,
        "closed",
      );
      assert.ok(returned.decision.response);
      assert.match(returned.decision.response, /confound|format|causal/i);
      assert.ok(
        returned.decision.response.includes(research.output.archivePath),
      );
      assert.equal(returned.decision.followUp, undefined);
    },
  );
  const preferenceText =
    "Whenever I share a research paper, start with the experimental evidence and whether it supports the conclusion.";
  await fixture.turn({
    id: "preference-1",
    conversation: "preferences",
    text: preferenceText,
    skipMemoryProjection: true,
  });
  check("preference remains unapplied before post-commit projection", () =>
    assert.equal(fixture.book.read().preferences.length, 0),
  );
  fixture.reopen();
  fixture.projectAcceptedPreferences();
  check(
    "accepted preference recovers after reopen and replays exactly once",
    () => {
      assert.equal(fixture.book.read().preferences.length, 1);
      assert.equal(fixture.book.read().revision, 1);
      assert.equal(
        fixture.book.read().preferences[0].source.messageId,
        "preference-1",
      );
    },
  );
  const next = await fixture.turn({
    id: "link-2",
    conversation: "fresh-research",
    text: "https://research.example.test/new-evaluation",
  });
  check("fresh conversation uses the saved paper preference", () => {
    assert.equal(next.decision.followUp?.appId, "scout-knowledge-lib");
    assert.match(
      JSON.stringify(next.decision.followUp?.input),
      /experimental|experiments|empirical/i,
    );
    assert.match(JSON.stringify(next.decision.followUp?.input), /conclusion/i);
    assert.equal(fixture.book.read().revision, 1);
  });
  const partial = await fixture.research(next.settled.admittedTasks[0].taskId);
  check("abstract-only access is archived honestly", () => {
    assert.match(
      readFileSync(partial.output.archivePath, "utf8"),
      /Coverage: abstract/,
    );
    assert.match(
      partial.output.summary,
      /abstract|full.{0,5}text|insufficient|unavailable/i,
    );
  });
  const exception = await fixture.turn({
    id: "exception",
    conversation: "exception",
    text: "For this one, just explain the abstract briefly here; don't save it or start background research: https://research.example.test/new-evaluation",
  });
  check(
    "one-time no-save exception does not erase the standing preference",
    () => {
      assert.equal(exception.decision.followUp, undefined);
      assert.equal(fixture.book.read().revision, 1);
      assert.ok(exception.decision.response);
    },
  );
  const translation = await fixture.turn({
    id: "translation",
    conversation: "translation",
    text: "Translate the sentence 'Context budgets matter' into French. It comes from https://blog.example.test/context-budget",
  });
  check("a translation request containing a link stays a translation", () => {
    assert.equal(translation.decision.followUp, undefined);
    assert.equal(fixture.book.read().revision, 1);
    assert.match(translation.decision.response ?? "", /contexte/i);
  });
  const logs = await fixture.turn({
    id: "logs",
    conversation: "logs",
    text: "Explain this log line: GET https://papers.example.test/controlled-memory -> 404 Not Found. I am debugging a URL path.",
  });
  check("a paper URL inside a log does not trigger research", () => {
    assert.equal(logs.decision.followUp, undefined);
    assert.equal(fixture.book.read().revision, 1);
  });
  await fixture.turn({
    id: "source-instruction",
    conversation: "source-instruction",
    text: "Read https://blog.example.test/context-budget and tell me what it says, briefly here. No background work.",
  });
  check("instructions inside source content do not rewrite preferences", () =>
    assert.equal(fixture.book.read().revision, 1),
  );
  await fixture.turn({
    id: "thanks",
    conversation: "source-instruction",
    text: "Thanks.",
  });
  check("acknowledgment creates no preference", () =>
    assert.equal(fixture.book.read().revision, 1),
  );
  await fixture.turn({
    id: "forget",
    conversation: "forget",
    text: "Forget my standing preference to start research-paper discussions with experimental evidence and whether it supports the conclusion.",
  });
  check("explicit forgetting removes the rule", () => {
    assert.equal(fixture.book.read().preferences.length, 0);
    assert.equal(fixture.book.read().revision, 2);
  });
  writeFileSync(
    join(root, "checks.json"),
    JSON.stringify({ status: "passed", checks }, null, 2),
  );
  console.log(
    JSON.stringify({ event: "trial-complete", root, passed: checks.length }),
  );
} catch (error) {
  writeFileSync(
    join(root, "checks.json"),
    JSON.stringify({ status: "failed", checks, error: String(error) }, null, 2),
  );
  console.error(
    JSON.stringify({ event: "trial-failed", root, error: String(error) }),
  );
  process.exitCode = 1;
} finally {
  fixture.close();
}
