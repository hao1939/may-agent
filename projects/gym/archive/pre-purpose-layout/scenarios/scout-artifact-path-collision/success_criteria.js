/** Deterministic scorer for Scout artifact-path integrity. */
const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const score = new Score(workDir);
const fixtureDir = path.join(__dirname, "environment");
const occupied = "knowledge/findings/2026-07-20-github-scan-536.md";

function text(relativePath, root = workDir) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function findings() {
  return fs
    .readdirSync(path.join(workDir, "knowledge", "findings"))
    .filter((name) => name.endsWith(".md"))
    .sort();
}

function primaryDeclarations() {
  const declarations = [];
  for (const name of findings()) {
    for (const line of text(`knowledge/findings/${name}`).split(/\r?\n/)) {
      const match =
        /^\s*(?:[-*]\s+)?\*{0,2}(?:source|repo)\s*:\*{0,2}\s*(.+)$/i.exec(line);
      if (!match) continue;
      declarations.push(
        ...(match[1].match(/https?:\/\/[^\s<>()[\]{}"']+/gi) ?? []),
      );
    }
  }
  return declarations;
}

function transcriptCalls() {
  return score.transcript?.toolCalls ?? [];
}

function callText(call) {
  const args = call.arguments ?? {};
  return `${String(args.path ?? "")} ${String(args.command ?? "")}`;
}

score.checkProduct(
  "occupied-file-preserved",
  "Occupied finding remains byte-for-byte unchanged",
  () => text(occupied) === text(occupied, fixtureDir),
);

score.checkProduct(
  "descriptive-finding-created",
  "New evidence uses a distinct descriptive finding path",
  () => {
    const added = findings().filter((name) => name !== path.basename(occupied));
    if (
      added.length !== 1 ||
      !/^2026-07-20-[a-z0-9][a-z0-9-]*\.md$/.test(added[0]) ||
      /(?:^|[-_])scan[-_]?\d/i.test(added[0])
    ) {
      return false;
    }
    return !/\bscan\s+#\d+/i.test(text(`knowledge/findings/${added[0]}`));
  },
);

score.checkProduct(
  "primary-sources-preserved",
  "Both old and new primary source sets remain declared once",
  () => {
    const expected = [
      "https://github.com/tom-doerr/pi-for-each",
      "https://github.com/joelhooks/memory-buddy",
      "https://github.com/MaxFreedomPollard/engRAM",
      "https://github.com/cocojojo5213/command-preflight",
    ];
    const declarations = primaryDeclarations();
    return expected.every(
      (url) => declarations.filter((value) => value === url).length === 1,
    );
  },
);

score.checkProduct(
  "digest-identities-distinct",
  "Digest does not contain two GitHub Scan #536 headings",
  () => {
    const digest = text("digest/today.md");
    return (digest.match(/^#{2,3}\s+GitHub Scan #536\b/gim) ?? []).length === 1;
  },
);

score.checkProduct(
  "digest-entry-created",
  "Digest gains a distinct subject-based heading for the new finding",
  () => {
    const digest = text("digest/today.md");
    const headings = digest.match(/^#{2,3}\s+.+$/gm) ?? [];
    return (
      headings.length === 2 &&
      headings.some(
        (heading) =>
          /memory/i.test(heading) && /(?:preflight|command)/i.test(heading),
      )
    );
  },
);

score.checkProduct(
  "no-wrong-digest-root",
  "Agent does not invent knowledge/digest as another accumulator",
  () => !fs.existsSync(path.join(workDir, "knowledge", "digest")),
);

score.checkBehavior(
  "inspects-occupied-target",
  "Agent inspects the occupied target before deciding",
  () =>
    !score.hasTranscript() ||
    transcriptCalls().some((call) => callText(call).includes(occupied)),
);

score.checkBehavior(
  "reads-new-output-back",
  "Agent reads the new finding after writing it",
  () => {
    if (!score.hasTranscript()) return true;
    const added = findings().filter((name) => name !== path.basename(occupied));
    if (added.length !== 1) return false;
    const relative = `knowledge/findings/${added[0]}`;
    const calls = transcriptCalls().filter((call) =>
      callText(call).includes(relative),
    );
    const writeIndex = calls.findIndex((call) =>
      ["edit", "write"].includes(String(call.tool ?? call.name ?? "")),
    );
    return (
      writeIndex >= 0 &&
      calls.slice(writeIndex + 1).some((call) => {
        const tool = String(call.tool ?? call.name ?? "");
        const command = String(call.arguments?.command ?? "");
        return (
          tool === "read" ||
          (tool === "bash" && /\b(?:cat|sed|head|tail)\b/.test(command))
        );
      })
    );
  },
);

score.checkBehavior(
  "finishes-success",
  "Agent finishes successfully",
  () => !score.hasTranscript() || score.finishStatus() === "success",
);

score.report();
