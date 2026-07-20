/**
 * Scout source-already-covered scorer.
 *
 * The current source packet is fully represented in the existing finding. The
 * correct result is an evidence-backed no-op after inspecting both files.
 */
const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const score = new Score(workDir);
const fixtureDir = path.join(__dirname, "environment");
const findingPath = "knowledge/findings/2026-07-20-hn-scan.md";
const digestPath = "digest/today.md";

function unchanged(relativePath) {
  return (
    fs.readFileSync(path.join(workDir, relativePath), "utf8") ===
    fs.readFileSync(path.join(fixtureDir, relativePath), "utf8")
  );
}

score.checkProduct(
  "existing-finding-unchanged",
  "Existing covered finding remains unchanged",
  () => unchanged(findingPath),
);

score.checkProduct(
  "no-extra-finding",
  "No duplicate finding is created",
  () => {
    const findings = fs
      .readdirSync(path.join(workDir, "knowledge", "findings"))
      .filter((name) => name.endsWith(".md"));
    return (
      findings.length === 1 && findings[0] === "2026-07-20-hn-scan.md"
    );
  },
);

score.checkProduct("digest-unchanged", "Digest remains unchanged", () =>
  unchanged(digestPath),
);

function transcriptCalls() {
  return score.transcript?.toolCalls ?? [];
}

function callText(call) {
  const args = call.arguments ?? {};
  return `${String(args.path ?? "")} ${String(args.command ?? "")}`;
}

score.checkBehavior(
  "reads-current-source",
  "Agent reads the current source packet",
  () =>
    !score.hasTranscript() ||
    transcriptCalls().some((call) =>
      callText(call).includes("current-source.md"),
    ),
);

score.checkBehavior(
  "opens-matched-finding",
  "Agent opens the matched existing finding before concluding",
  () =>
    !score.hasTranscript() ||
    transcriptCalls().some((call) => callText(call).includes(findingPath)),
);

score.checkBehavior(
  "no-knowledge-writes",
  "Agent does not write a duplicate finding or digest entry",
  () => {
    if (!score.hasTranscript()) return true;
    for (const call of transcriptCalls()) {
      const tool = String(call.tool ?? call.name ?? "");
      const text = callText(call);
      const targetsLibrary =
        text.includes("knowledge/") || text.includes("digest/today.md");
      if (!targetsLibrary) continue;
      if (tool === "edit" || tool === "write") return false;
      if (
        tool === "bash" &&
        (/(?:^|[\s;])(?:1?>{1,2})\s*(?!\/dev\/null(?:\s|;|$))/.test(
          String(call.arguments?.command ?? ""),
        ) ||
          /(?:\btee\b|\bsed\s+-i\b|\bperl\s+-i\b|\b(?:cp|mv|rm)\s)/.test(
            String(call.arguments?.command ?? ""),
          ))
      ) {
        return false;
      }
    }
    return true;
  },
);

score.checkBehavior(
  "honest-no-op",
  "Agent explicitly reports that current source evidence is already covered",
  () => {
    if (!score.hasTranscript()) return true;
    const pattern =
      /(?:evidence[- ]backed\s+no-op|already\s+(?:captured|covered|represented|documented)|no\s+(?:new\s+)?(?:findings?|changes?|updates?)\s+(?:are\s+|is\s+)?(?:needed|required|warranted))/i;
    return (
      score.anyMessageContains(pattern) ||
      pattern.test(String(score.finishCall()?.summary ?? ""))
    );
  },
);

score.checkBehavior(
  "finishes-success",
  "Agent finishes successfully",
  () => !score.hasTranscript() || score.finishStatus() === "success",
);

score.checkEfficiency(
  "bounded-operations",
  "Covered-source no-op completes within 15 operations",
  () => score.ops() <= 15,
);

score.report();
