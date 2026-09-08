import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type JsonObject = Record<string, unknown>;

type EvidenceReference = {
  path: string;
  fragment: string;
};

type ProvenanceEntry = {
  entry_id: string;
  producer_source: string;
  producer_result: string;
  accepted_evidence: EvidenceReference;
  seed_receipt: string;
  review: string;
  limitation: string;
  integration: "exact";
  rollback: "revert-producer-result-after-dependents";
};

type ProvenanceFixture = {
  schema: "scout.provenance-replacement/v1";
  frozen_against_tip: string;
  evidence_tip: string;
  projection_fixture: string;
  review: { id: string; source: string; result: string };
  seed_receipts: Array<{
    id: string;
    source_commit: string;
    source_evidence: EvidenceReference;
    source_section_sha256: string;
    observed_through: string;
    stable_identity_count: number;
    observed_removals: string[];
    access: "login-class-unavailable-observational-only";
  }>;
  record: {
    entries: ProvenanceEntry[];
    retained_literals: { commit_refs: string[]; timestamps: string[] };
  };
  audit: {
    absent_heading_count: number;
    absent_headings_sha256: string;
    generic_headings: string[];
    omitted_operational_timestamps: string[];
    omitted_operational_sha256: string;
    expected_projection: { broad_documents: number; broad_links: number };
  };
};

type ProjectionOutput = {
  absent_after_projection: {
    headings: string[];
    commit_refs: string[];
    timestamps: string[];
    urls: string[];
  };
  broad_links: {
    ok: boolean;
    documents: number;
    checked: number;
    errors: string[];
  };
};

const sha = /^[0-9a-f]{40}$/u;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, keys: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys must be exactly ${expected.join(",")}`);
  }
}

function nonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => nonempty(item, `${label}[${index}]`));
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
}

function sha256(values: string[]): string {
  return createHash("sha256")
    .update([...values].sort().join("\n"))
    .digest("hex");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameStrings(
  actual: string[],
  expected: string[],
  label: string,
): void {
  if (
    JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())
  ) {
    throw new Error(`${label} does not match the source-bound projection`);
  }
}

export function githubHeadingFragment(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
    .replace(/ /gu, "-");
}

export function fragmentMatchCount(markdown: string, fragment: string): number {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,6}\s+/u.test(line))
    .map((line) =>
      githubHeadingFragment(
        line.replace(/^#{1,6}\s+/u, "").replace(/\s+#+\s*$/u, ""),
      ),
    )
    .filter((candidate) => candidate === fragment).length;
}

export function markdownSection(markdown: string, fragment: string): string {
  const lines = markdown.split("\n");
  const matches = lines.flatMap((line, index) => {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!heading || githubHeadingFragment(heading[2]) !== fragment) return [];
    return [{ index, level: heading[1].length }];
  });
  if (matches.length !== 1) {
    throw new Error(`evidence fragment resolved ${matches.length} times`);
  }
  const [{ index, level }] = matches;
  const end = lines.findIndex((line, candidateIndex) => {
    if (candidateIndex <= index) return false;
    const heading = line.match(/^(#{1,6})\s+/u);
    return Boolean(heading && heading[1].length <= level);
  });
  return lines.slice(index, end === -1 ? undefined : end).join("\n");
}

export function validateSeedReceiptEvidence(
  receipt: ProvenanceFixture["seed_receipts"][number],
  markdown: string,
): void {
  const section = markdownSection(markdown, receipt.source_evidence.fragment);
  if (sha256Text(section) !== receipt.source_section_sha256) {
    throw new Error(`${receipt.id} source section digest mismatch`);
  }
  if (
    !section.includes(receipt.observed_through.split("T").at(-1) ?? "") ||
    !new RegExp(`\\b${receipt.stable_identity_count}\\b`, "u").test(section) ||
    !section.includes("[]") ||
    !/unavailable/iu.test(section) ||
    !/no (?:account|xhs) (?:or content )?state\s+(?:was\s+)?changed|no account mutation occurred/iu.test(
      section,
    )
  ) {
    throw new Error(`${receipt.id} fields do not match its source section`);
  }
}

function evidenceReference(value: unknown, label: string): EvidenceReference {
  const evidence = object(value, label);
  exactKeys(evidence, ["path", "fragment"], label);
  const path = nonempty(evidence.path, `${label}.path`);
  if (
    !path.startsWith("projects/scout-knowledge-lib/knowledge/") ||
    !path.endsWith(".md") ||
    path.includes("..")
  ) {
    throw new Error(`${label} path leaves canonical knowledge`);
  }
  return {
    path,
    fragment: nonempty(evidence.fragment, `${label}.fragment`),
  };
}

export function validateProvenanceFixtureShape(
  raw: unknown,
): ProvenanceFixture {
  const fixture = object(raw, "fixture");
  exactKeys(
    fixture,
    [
      "schema",
      "frozen_against_tip",
      "evidence_tip",
      "projection_fixture",
      "review",
      "seed_receipts",
      "record",
      "audit",
    ],
    "fixture",
  );
  if (fixture.schema !== "scout.provenance-replacement/v1") {
    throw new Error("unsupported provenance replacement schema");
  }
  for (const key of ["frozen_against_tip", "evidence_tip"] as const) {
    if (!sha.test(nonempty(fixture[key], key))) {
      throw new Error(`${key} must be a full commit SHA`);
    }
  }
  if (
    !/^scout-history-projection-[a-z0-9-]+\.json$/u.test(
      nonempty(fixture.projection_fixture, "projection_fixture"),
    )
  ) {
    throw new Error("projection_fixture must name a versioned fixture");
  }

  const review = object(fixture.review, "review");
  exactKeys(review, ["id", "source", "result"], "review");
  nonempty(review.id, "review.id");
  for (const key of ["source", "result"] as const) {
    if (!sha.test(nonempty(review[key], `review.${key}`))) {
      throw new Error(`review.${key} must be a full commit SHA`);
    }
  }

  if (!Array.isArray(fixture.seed_receipts)) {
    throw new Error("seed_receipts must be an array");
  }
  const receiptIds = fixture.seed_receipts.map((value, index) => {
    const receipt = object(value, `seed_receipts[${index}]`);
    exactKeys(
      receipt,
      [
        "id",
        "source_commit",
        "source_evidence",
        "source_section_sha256",
        "observed_through",
        "stable_identity_count",
        "observed_removals",
        "access",
      ],
      `seed_receipts[${index}]`,
    );
    const id = nonempty(receipt.id, `seed_receipts[${index}].id`);
    if (!sha.test(nonempty(receipt.source_commit, `${id}.source_commit`))) {
      throw new Error(`${id}.source_commit must be a full commit SHA`);
    }
    evidenceReference(receipt.source_evidence, `${id}.source_evidence`);
    if (
      !/^[0-9a-f]{64}$/u.test(
        nonempty(receipt.source_section_sha256, `${id}.source_section_sha256`),
      )
    ) {
      throw new Error(`${id}.source_section_sha256 must be SHA-256`);
    }
    if (
      !timestamp.test(nonempty(receipt.observed_through, "observed_through"))
    ) {
      throw new Error(
        "seed receipt observed_through must be an exact UTC time",
      );
    }
    if (receipt.stable_identity_count !== 132) {
      throw new Error("seed receipt stable_identity_count must remain 132");
    }
    if (
      !Array.isArray(receipt.observed_removals) ||
      receipt.observed_removals.length !== 0
    ) {
      throw new Error("seed receipt observed_removals must remain empty");
    }
    if (receipt.access !== "login-class-unavailable-observational-only") {
      throw new Error("seed receipt access boundary changed");
    }
    return id;
  });
  unique(receiptIds, "seed receipt ids");

  const record = object(fixture.record, "record");
  exactKeys(record, ["entries", "retained_literals"], "record");
  if (!Array.isArray(record.entries) || record.entries.length !== 14) {
    throw new Error("record.entries must contain exactly fourteen entries");
  }
  const entryBindings = record.entries.map((value, index) => {
    const entry = object(value, `record.entries[${index}]`);
    exactKeys(
      entry,
      [
        "entry_id",
        "producer_source",
        "producer_result",
        "accepted_evidence",
        "seed_receipt",
        "review",
        "limitation",
        "integration",
        "rollback",
      ],
      `record.entries[${index}]`,
    );
    const entryId = nonempty(entry.entry_id, "entry_id");
    for (const key of ["producer_source", "producer_result"] as const) {
      if (!sha.test(nonempty(entry[key], `${entryId}.${key}`))) {
        throw new Error(`${entryId}.${key} must be a full commit SHA`);
      }
    }
    const evidence = evidenceReference(
      entry.accepted_evidence,
      `${entryId}.accepted_evidence`,
    );
    if (!receiptIds.includes(nonempty(entry.seed_receipt, "seed_receipt"))) {
      throw new Error(`${entryId} references an unknown seed receipt`);
    }
    if (entry.review !== review.id) {
      throw new Error(`${entryId} references an unknown review`);
    }
    nonempty(entry.limitation, `${entryId}.limitation`);
    if (entry.integration !== "exact") {
      throw new Error(`${entryId} integration must be exact`);
    }
    if (entry.rollback !== "revert-producer-result-after-dependents") {
      throw new Error(`${entryId} rollback boundary changed`);
    }
    return {
      entryId,
      cycle: Number(entryId.match(/^cycle-(\d+)-/u)?.[1] ?? NaN),
      producerSource: entry.producer_source as string,
      producerResult: entry.producer_result as string,
      evidenceIdentity: `${evidence.path}#${evidence.fragment}`,
    };
  });
  const entryIds = entryBindings.map((entry) => entry.entryId);
  unique(entryIds, "entry ids");
  unique(
    entryBindings.map((entry) => entry.producerResult),
    "producer results",
  );
  unique(
    entryBindings.map((entry) => entry.evidenceIdentity),
    "accepted evidence references",
  );
  const cycles = entryBindings
    .map((entry) => entry.cycle)
    .sort((left, right) => left - right);
  if (
    JSON.stringify(cycles) !==
    JSON.stringify(Array.from({ length: 14 }, (_, index) => 373 + index))
  ) {
    throw new Error("entry ids must cover each Cycle 373-386 exactly once");
  }
  const orderedEntries = [...entryBindings].sort(
    (left, right) => left.cycle - right.cycle,
  );
  for (let index = 1; index < orderedEntries.length; index += 1) {
    if (
      orderedEntries[index].producerSource !==
      orderedEntries[index - 1].producerResult
    ) {
      throw new Error("producer entries must form one contiguous cycle chain");
    }
  }
  if (orderedEntries.at(-1)?.producerResult !== review.source) {
    throw new Error("producer cycle chain must end at the review source");
  }

  const retained = object(record.retained_literals, "record.retained_literals");
  exactKeys(
    retained,
    ["commit_refs", "timestamps"],
    "record.retained_literals",
  );
  const commitRefs = strings(retained.commit_refs, "retained commit refs");
  const retainedTimestamps = strings(
    retained.timestamps,
    "retained timestamps",
  );
  unique(commitRefs, "retained commit refs");
  unique(retainedTimestamps, "retained timestamps");
  if (commitRefs.some((value) => !/^[0-9a-f]{7,40}$/u.test(value))) {
    throw new Error("retained commit refs contain an invalid identity");
  }
  if (retainedTimestamps.some((value) => !timestamp.test(value))) {
    throw new Error("retained timestamps contain an invalid UTC time");
  }

  const audit = object(fixture.audit, "audit");
  exactKeys(
    audit,
    [
      "absent_heading_count",
      "absent_headings_sha256",
      "generic_headings",
      "omitted_operational_timestamps",
      "omitted_operational_sha256",
      "expected_projection",
    ],
    "audit",
  );
  if (!Number.isSafeInteger(audit.absent_heading_count)) {
    throw new Error("absent_heading_count must be an integer");
  }
  if (
    !/^[0-9a-f]{64}$/u.test(
      nonempty(audit.absent_headings_sha256, "absent_headings_sha256"),
    )
  ) {
    throw new Error("absent_headings_sha256 must be SHA-256");
  }
  unique(
    strings(audit.generic_headings, "generic_headings"),
    "generic_headings",
  );
  const omitted = strings(
    audit.omitted_operational_timestamps,
    "omitted_operational_timestamps",
  );
  unique(omitted, "omitted_operational_timestamps");
  if (omitted.some((value) => !timestamp.test(value))) {
    throw new Error("omitted operational timestamps contain an invalid time");
  }
  if (sha256(omitted) !== audit.omitted_operational_sha256) {
    throw new Error("omitted operational timestamp digest mismatch");
  }
  const expected = object(
    audit.expected_projection,
    "audit.expected_projection",
  );
  exactKeys(
    expected,
    ["broad_documents", "broad_links"],
    "audit.expected_projection",
  );
  if (
    !Number.isSafeInteger(expected.broad_documents) ||
    !Number.isSafeInteger(expected.broad_links)
  ) {
    throw new Error("expected projection counts must be integers");
  }
  return raw as ProvenanceFixture;
}

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function projection(appDir: string, fixture: string): ProjectionOutput {
  const result = spawnSync(
    "bun",
    ["./scripts/scout-history-projection.ts", fixture],
    { cwd: appDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "history projection failed");
  }
  return JSON.parse(result.stdout) as ProjectionOutput;
}

function classifyHeadings(headings: string[], generic: string[]): void {
  const genericSet = new Set(generic);
  for (const heading of headings) {
    if (genericSet.has(heading)) continue;
    if (
      /^Cycle (?:37[3-9]|38[0-6]) (?:checkpoint|seed-first start|exact-commit validation boundary)(?:\s|$)/u.test(
        heading,
      )
    ) {
      continue;
    }
    throw new Error(`unclassified absent heading: ${heading}`);
  }
}

export function replacementRemainder(
  output: ProjectionOutput,
  record: ProvenanceFixture["record"],
): ProjectionOutput["absent_after_projection"] {
  const replacement = JSON.stringify(record);
  const absent = output.absent_after_projection;
  const remaining = (values: string[]) =>
    values.filter((value) => !replacement.includes(value));
  return {
    headings: remaining(absent.headings),
    commit_refs: remaining(absent.commit_refs),
    timestamps: remaining(absent.timestamps),
    urls: remaining(absent.urls),
  };
}

export function inspectProvenanceReplacement(
  fixturePath: string,
): Record<string, unknown> {
  const fixture = validateProvenanceFixtureShape(
    JSON.parse(readFileSync(fixturePath, "utf8")),
  );
  const appDir = resolve(dirname(fixturePath), "../..");
  const root = resolve(appDir, "../..");
  git(root, [
    "merge-base",
    "--is-ancestor",
    fixture.frozen_against_tip,
    "HEAD",
  ]);
  git(root, [
    "merge-base",
    "--is-ancestor",
    fixture.evidence_tip,
    fixture.frozen_against_tip,
  ]);
  if (
    git(root, ["rev-parse", `${fixture.review.result}^`]) !==
    fixture.review.source
  ) {
    throw new Error("review result is not a direct child of review source");
  }

  const receipts = new Map(
    fixture.seed_receipts.map((receipt) => [receipt.id, receipt]),
  );
  for (const receipt of fixture.seed_receipts) {
    git(root, [
      "merge-base",
      "--is-ancestor",
      receipt.source_commit,
      fixture.evidence_tip,
    ]);
    const markdown = git(root, [
      "show",
      `${receipt.source_commit}:${receipt.source_evidence.path}`,
    ]);
    validateSeedReceiptEvidence(receipt, markdown);
  }

  for (const entry of fixture.record.entries) {
    if (
      git(root, ["rev-parse", `${entry.producer_result}^`]) !==
      entry.producer_source
    ) {
      throw new Error(
        `${entry.entry_id} result is not a direct child of its source`,
      );
    }
    git(root, [
      "merge-base",
      "--is-ancestor",
      entry.producer_result,
      fixture.review.source,
    ]);
    const receipt = receipts.get(entry.seed_receipt);
    if (!receipt) throw new Error(`${entry.entry_id} receipt is unavailable`);
    git(root, [
      "merge-base",
      "--is-ancestor",
      receipt.source_commit,
      entry.producer_result,
    ]);
    const markdown = git(root, [
      "show",
      `${fixture.evidence_tip}:${entry.accepted_evidence.path}`,
    ]);
    const matches = fragmentMatchCount(
      markdown,
      entry.accepted_evidence.fragment,
    );
    if (matches !== 1) {
      throw new Error(
        `${entry.entry_id} evidence fragment resolved ${matches} times`,
      );
    }
  }

  const output = projection(appDir, fixture.projection_fixture);
  if (!output.broad_links.ok)
    throw new Error("source-bound broad link audit failed");
  if (
    output.broad_links.documents !==
      fixture.audit.expected_projection.broad_documents ||
    output.broad_links.checked !== fixture.audit.expected_projection.broad_links
  ) {
    throw new Error("source-bound broad link counts changed");
  }
  sameStrings(
    fixture.record.retained_literals.commit_refs,
    output.absent_after_projection.commit_refs,
    "retained commit refs",
  );
  const expectedRetainedTimestamps =
    output.absent_after_projection.timestamps.filter(
      (value) => !fixture.audit.omitted_operational_timestamps.includes(value),
    );
  sameStrings(
    fixture.record.retained_literals.timestamps,
    expectedRetainedTimestamps,
    "retained timestamps",
  );
  if (
    output.absent_after_projection.headings.length !==
      fixture.audit.absent_heading_count ||
    sha256(output.absent_after_projection.headings) !==
      fixture.audit.absent_headings_sha256
  ) {
    throw new Error("absent heading boundary changed");
  }
  classifyHeadings(
    output.absent_after_projection.headings,
    fixture.audit.generic_headings,
  );

  const remainder = replacementRemainder(output, fixture.record);
  if (remainder.commit_refs.length !== 0 || remainder.urls.length !== 0) {
    throw new Error("replacement loses a commit reference or URL");
  }
  sameStrings(
    remainder.timestamps,
    fixture.audit.omitted_operational_timestamps,
    "remaining operational timestamps",
  );
  if (
    remainder.headings.length !== fixture.audit.absent_heading_count ||
    sha256(remainder.headings) !== fixture.audit.absent_headings_sha256
  ) {
    throw new Error("replacement unexpectedly retains or loses a heading");
  }

  return {
    ok: true,
    frozen_against_tip: fixture.frozen_against_tip,
    evidence_tip: fixture.evidence_tip,
    entries: fixture.record.entries.length,
    evidence_fragments_unique: fixture.record.entries.length,
    receipt_sections_bound: fixture.seed_receipts.length,
    producer_chain_bound: true,
    retained_commit_refs: fixture.record.retained_literals.commit_refs.length,
    retained_timestamps: fixture.record.retained_literals.timestamps.length,
    omitted_operational_timestamps: remainder.timestamps.length,
    classified_structural_headings: remainder.headings.length,
    broad_links: output.broad_links,
  };
}

if (import.meta.main) {
  const fixtureName = process.argv[2];
  if (
    !fixtureName ||
    !/^scout-provenance-replacement-[a-z0-9-]+\.json$/u.test(fixtureName)
  ) {
    throw new Error(
      "pass one scout-provenance-replacement-*.json fixture name",
    );
  }
  const fixturePath = resolve(import.meta.dir, "fixtures", fixtureName);
  process.stdout.write(
    `${JSON.stringify(inspectProvenanceReplacement(fixturePath), null, 2)}\n`,
  );
}
