/**
 * Scout explore — routine discovery cron task.
 *
 * Called with a source-specific task (arXiv, HN, XHS, GitHub, Reddit). The workflow
 * prepares source evidence where available, then admits one bounded result.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import {
  type ExecutionResult,
  type TaskReconcileResult,
  Type,
  type WorkflowContext,
} from "@may-agent/sdk";
import {
  inspectXhsCredential,
  type XhsCredentialStatus,
} from "../tools/lib/xhs-credential.js";
import {
  searchXhs,
  type XhsSearchItem,
  type XhsSearchResult,
} from "../tools/lib/xhs-source.js";
import { retainAcceptedPublication } from "./lib/accepted-publication.js";
import {
  changedKnowledgePaths,
  publicationFacts,
  publishKnowledgeChanges,
  retainedCandidateFacts,
  snapshotKnowledge,
} from "./lib/knowledge-publication.js";

type TaskHandlerResult = Exclude<TaskReconcileResult, { state: "needs-agent" }>;

export const name = "scout-explore";
export const description =
  "Routine discovery — fetch and process a specific source.";

const defaultAppDir = "/app/projects/scout-knowledge-lib.app";
const defaultProjectDir = "/app/projects/scout-knowledge-lib";
const defaultXhsQuery = "AI agent 智能体";
const sourceNames = ["arxiv", "hn", "xhs", "github", "reddit"] as const;

type SourceName = (typeof sourceNames)[number];

type SourceObservation = {
  name: SourceName;
  queryOrFeed: string;
  checkedAt: string;
  fingerprint?: string;
  itemIdsOrUrls: string[];
};

type AgentSourceObservation = Omit<SourceObservation, "checkedAt">;

const ExploreAgentResultSchema = Type.Object({
  summary: Type.String({ minLength: 1, maxLength: 1000 }),
  source: Type.Object({
    name: Type.Union(sourceNames.map((source) => Type.Literal(source))),
    queryOrFeed: Type.String({ minLength: 1, maxLength: 300 }),
    fingerprint: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    itemIdsOrUrls: Type.Array(Type.String({ maxLength: 500 }), {
      maxItems: 20,
    }),
  }),
  outputs: Type.Array(Type.String({ maxLength: 1000 }), { maxItems: 20 }),
});

type ExploreAgentResult = {
  summary: string;
  source: AgentSourceObservation;
  outputs: string[];
};

export type ScoutExploreDependencies = {
  inspectXhsCredential(appDir: string): Promise<XhsCredentialStatus>;
  searchXhs(appDir: string, query: string): XhsSearchResult;
};

const defaultDependencies: ScoutExploreDependencies = {
  inspectXhsCredential,
  searchXhs,
};

export function buildExploreTask(
  task: string,
  paths: { appDir: string; projectDir: string } = {
    appDir: defaultAppDir,
    projectDir: defaultProjectDir,
  },
  xhsPacket?: { query: string; items: XhsSearchItem[] },
  selectedSource?: SourceName,
): string {
  const source = selectedSource ?? reconciliationSource(task);
  const sourceContract =
    source === "xhs"
      ? `
XHS execution contract:
- The workflow already performed the current live status and search calls. Do not infer current access from old blocked findings, cookie-file timestamps, or legacy cookie paths.
- Use the current source packet below as the discovery starting point. When a promising item needs detail, use the existing bash tool: \`node "${paths.appDir}/agents/scout/tools/xhs-browse.mjs" read "FULL_RETURNED_LINK"\`, with a 45-second tool timeout.
- Use the full returned link for that read; never copy access tokens into notes, digests, or result evidence. Keep XHS access observational.
- Search cards support discovery, not body-level claims. Distinguish "not inspected" from an actual failed read; do not call a body unavailable without trying the detail reader. A failed read should name its exact access boundary without bypassing it.
- Only write a finding when current source content supports it. Never create or update a blocked-scan knowledge or digest artifact from stale notes.

Current XHS source packet:
\`\`\`json
${JSON.stringify(xhsPacket ?? { query: "missing", items: [] }, null, 2)}
\`\`\`
`
      : source === "arxiv"
        ? `
arXiv execution contract:
- Every arXiv HTTP request must have both a bounded connection timeout and a bounded total timeout. For curl, supply both \`--connect-timeout\` and \`--max-time\`; do not run an unbounded retrieval.
- If arXiv cannot be reached within those bounds, do not substitute another source. Return an evidence-backed no-op with outputs: [], naming the attempted endpoint and the timeout or retrieval error.
`
        : source === "github"
          ? `
GitHub execution contract:
- Access GitHub observationally through read-only public endpoints only. Never create, edit, comment on, star, watch, fork, or otherwise change a repository or account.
- Begin topic-led repository discovery with the public repository Search API at \`https://api.github.com/search/repositories\`. Preserve \`owner/name\` and, before using repository contents as claim evidence, pin the inspected commit revision.
- Every request must use a descriptive User-Agent, a bounded connection timeout, and a bounded total timeout. For curl, supply \`--connect-timeout\` and \`--max-time\`.
- Record \`incomplete_results\` for Search API responses. Never describe a search as complete when \`incomplete_results\` is true, or treat repository metadata and paper indexes as proof that an implementation exists or works.
- If GitHub returns an authentication, rate-limit, network-security, or retrieval boundary, do not bypass it or substitute another source. Return an evidence-backed no-op with outputs: [], naming the attempted endpoint and exact HTTP status or retrieval error.
`
          : source === "reddit"
            ? `
Reddit execution contract:
- Access Reddit observationally through read-only public endpoints only. Never post, comment, vote, save, follow, message, log in, or otherwise change account or content state.
- Start topic-led discovery with the public Atom feed at \`https://www.reddit.com/search.rss\`; preserve stable \`t3_...\` post IDs. Treat feed titles and timestamps as metadata, not support for body-level claims, unless the post itself is readable.
- Every request must use a descriptive User-Agent, a bounded connection timeout, and a bounded total timeout. For curl, supply \`--connect-timeout\` and \`--max-time\`.
- If Reddit returns an authentication, network-security, rate-limit, or retrieval boundary, do not bypass it or substitute another source. Return an evidence-backed no-op with outputs: [], naming the attempted endpoint and exact HTTP status or retrieval error.
`
            : "";
  const resultContract = `
Result contract:
- Return summary, source, and outputs through finish().
- source must identify the source name, exact query or feed checked, optional
  retrieval fingerprint, and at most 20 stable item IDs or credential-free
  URLs. The workflow supplies checkedAt; do not invent or return a timestamp.
- List every created or updated file as an absolute path in outputs.
- For an evidence-backed no-op, return outputs: [] and explain in summary why
  the current source observation did not justify a useful library change.
- Pick one promising candidate early; reserve time for integration and read-back.
  Running out of operations before completing useful work is partial progress,
  not an evidence-backed decision that no library change is worthwhile.
`;

  return `${task}${sourceContract}

Output contract:
- Durable Scout notes and findings belong under \`${paths.projectDir}/knowledge/\`.
- Source-level findings belong under \`${paths.projectDir}/knowledge/findings/\`.
- Run-level drafts may go under \`${paths.appDir}/agents/scout/workspace/findings/\`.
- A draft or digest alone is not library integration. For a useful new finding, return at least one created or updated knowledge file; preserve unfinished drafts and report partial progress instead of success.
- A read-only error applies to the exact path checked, not the whole library. Never bypass a protected file. If no suitable existing note is writable, a distinct source-grounded finding under the knowledge root may be appropriate; otherwise retain the draft and report the exact blocker.
- Append short user-facing highlights to \`${paths.appDir}/agents/scout/workspace/digest/today.md\` when useful.
- Search existing Scout knowledge files first and update an existing topical file when the topic already exists.
- Search primary Source:/Repo: URLs case-insensitively before writing. If any search returns a matching file, open it before deciding. Never create a new finding that repeats a primary source already present elsewhere; update the matched file or return an evidence-backed no-op.
- Before creating a finding, inspect the exact target path. Choose an unused descriptive topic slug; do not use a scan number as a shared filename allocator.
- Update an existing finding only for the same subject, and preserve all of its existing primary Source:/Repo: declarations.
- Read every created or changed output back before returning it.
- Treat these absolute roots as authoritative. Never prepend \`projects/scout-knowledge-lib\` to the current working directory.
- Never create new top-level folders under \`projects/\`. In particular, do not write paths like \`projects/explore/...\`, \`projects/research/...\`, or \`projects/docs/...\`.
- If none of the allowed output roots fit, finish with a blocker explaining the missing destination instead of inventing a folder.
- DATE RULE: Filename dates and internal Date/last_updated fields MUST NOT be later than today. Run \`date -u +%Y-%m-%d\` to get the current date. Never derive dates from scan numbers or arithmetic.
${resultContract}`;
}

function reconciliationSource(value: unknown): string {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return String(input.source ?? "").toLowerCase();
}

function sourceName(input: unknown): SourceName | null {
  const source = reconciliationSource(input);
  return sourceNames.includes(source as SourceName)
    ? (source as SourceName)
    : null;
}

export function xhsWaitResult(
  source: SourceName,
  credential: XhsCredentialStatus,
): TaskHandlerResult | null {
  if (source !== "xhs") return null;
  if (credential.state === "ready") return null;

  const summary =
    "XHS exploration is waiting for the browser credential to become ready; no source agent was started.";
  return {
    state: "waiting",
    summary,
    facts: [
      credential.reason,
      ...credential.evidence,
      "The source lane remains gated before agent dispatch.",
    ],
    actions: [],
    conditions: [
      {
        id: "credential-ready:xhs",
        type: "credential.state",
        subject: "credential:xhs",
        expected: { field: "state", equals: "ready" },
        owner: "human:operator",
        requestedAction:
          "Check the reported browser-access failure. Open Xiaohongshu in the container browser and sign in if prompted; leave the tab open for Scout.",
        reviewAfterMs: 3_600_000,
      },
    ],
  };
}

function xhsAccessEvidence(credential: XhsCredentialStatus): string[] {
  return [`access:${credential.state}`, ...credential.evidence];
}

export function admittedOutputPaths(
  outputs: string[],
  paths: { appDir: string; projectDir: string },
): string[] | null {
  const normalized = [
    ...new Set(outputs.map((output) => output.trim()).filter(Boolean)),
  ];
  if (normalized.some((output) => !isAbsolute(output))) return null;
  if (normalized.length === 0) return [];
  const roots = [
    resolve(paths.projectDir, "knowledge"),
    resolve(paths.appDir, "agents", "scout", "workspace"),
  ];
  try {
    // A valid note does not require the optional scratch root to exist yet.
    // Every returned file must still resolve inside an existing allowed root.
    const realRoots = roots
      .filter((root) => existsSync(root))
      .map((root) => realpathSync(root));
    const resolved = normalized.map((output) => {
      if (!existsSync(output) || !statSync(output).isFile()) throw new Error();
      return realpathSync(resolve(output));
    });
    return resolved.every((output) =>
      realRoots.some(
        (root) => output === root || output.startsWith(`${root}${sep}`),
      ),
    )
      ? resolved
      : null;
  } catch {
    return null;
  }
}

function sanitizeSourceItem(value: string): string {
  const compact = value.trim().slice(0, 500);
  try {
    const url = new URL(compact);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        /(auth|authorization|cookie|credential|key|password|secret|signature|token|xsec)/i.test(
          key,
        )
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return compact;
  }
}

type SourceObservationAdmission =
  | { ok: true; observation: SourceObservation }
  | {
      ok: false;
      invalidField: "source" | "name" | "queryOrFeed" | "itemIdsOrUrls";
      reason: string;
    };

function admitSourceObservation(
  value: unknown,
  expectedSource: SourceName,
  now: number,
): SourceObservationAdmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      invalidField: "source",
      reason: "source must be an object",
    };
  }
  const source = value as Record<string, unknown>;
  if (source.name !== expectedSource) {
    return {
      ok: false,
      invalidField: "name",
      reason: `expected ${expectedSource}`,
    };
  }
  const queryOrFeed = sanitizeSourceItem(
    String(source.queryOrFeed ?? "")
      .trim()
      .slice(0, 300),
  );
  if (!queryOrFeed) {
    return {
      ok: false,
      invalidField: "queryOrFeed",
      reason: "query or feed is empty",
    };
  }
  if (
    !Array.isArray(source.itemIdsOrUrls) ||
    !source.itemIdsOrUrls.every((item) => typeof item === "string")
  ) {
    return {
      ok: false,
      invalidField: "itemIdsOrUrls",
      reason: "item list must contain only strings",
    };
  }
  const itemIdsOrUrls = [
    ...new Set(
      source.itemIdsOrUrls
        .filter((item): item is string => typeof item === "string")
        .map(sanitizeSourceItem)
        .filter(Boolean),
    ),
  ].slice(0, 20);
  return {
    ok: true,
    observation: {
      name: expectedSource,
      queryOrFeed,
      checkedAt: new Date(now).toISOString(),
      ...(typeof source.fingerprint === "string" && source.fingerprint.trim()
        ? { fingerprint: source.fingerprint.trim().slice(0, 200) }
        : {}),
      itemIdsOrUrls,
    },
  };
}

function markdownFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
    }
  };
  try {
    visit(root);
  } catch {
    return files;
  }
  return files;
}

function realMarkdownFiles(root: string): string[] {
  return markdownFiles(root).flatMap((path) => {
    try {
      return [realpathSync(path)];
    } catch {
      return [];
    }
  });
}

function sourceUrls(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s<>()[\]{}"']+/gi) ?? [];
  return [
    ...new Set(
      matches
        .map((value) => value.replace(/[.,;:!?]+$/, ""))
        .map(sanitizeSourceItem)
        .filter(Boolean),
    ),
  ];
}

function declaredPrimarySourceUrls(line: string): string[] {
  const declaration =
    /^\s*(?:[-*]\s+)?\*{0,2}(?:source|repo)\s*:\*{0,2}\s*(.+)$/i.exec(line);
  return declaration ? sourceUrls(declaration[1]) : [];
}

export function primarySourceUrls(content: string): string[] {
  return [
    ...new Set(content.split(/\r?\n/).flatMap(declaredPrimarySourceUrls)),
  ];
}

type ExistingOutputSnapshot = Map<string, string[]>;

function snapshotExistingOutputPrimarySources(paths: {
  appDir: string;
  projectDir: string;
}): ExistingOutputSnapshot {
  const roots = [
    resolve(paths.projectDir, "knowledge"),
    resolve(paths.appDir, "agents", "scout", "workspace"),
  ];
  return new Map(
    roots.flatMap(realMarkdownFiles).flatMap((path) => {
      try {
        return [[path, primarySourceUrls(readFileSync(path, "utf8"))] as const];
      } catch {
        return [];
      }
    }),
  );
}

type ExistingOutputReplacement = {
  kind: "existing-output-replaced";
  output: string;
  removedPrimarySources: string[];
  currentPrimarySources: string[];
};

export function replacedExistingOutputs(
  outputs: string[],
  before: ExistingOutputSnapshot,
): ExistingOutputReplacement[] {
  return outputs.flatMap((output) => {
    const previous = before.get(output);
    if (!previous?.length) return [];
    let current: string[];
    try {
      current = primarySourceUrls(readFileSync(output, "utf8"));
    } catch {
      current = [];
    }
    const currentSet = new Set(current);
    const removedPrimarySources = previous.filter(
      (source) => !currentSet.has(source),
    );
    return removedPrimarySources.length > 0
      ? [
          {
            kind: "existing-output-replaced" as const,
            output,
            removedPrimarySources,
            currentPrimarySources: current,
          },
        ]
      : [];
  });
}

type DuplicateSourceReference =
  | {
      kind: "existing-file";
      output: string;
      sourceUrl: string;
      existingFiles: string[];
    }
  | {
      kind: "repeated-primary-source";
      output: string;
      sourceUrl: string;
      sections: string[];
    };

function repeatedPrimarySourceReferences(
  output: string,
  content: string,
): DuplicateSourceReference[] {
  const declarations = new Map<
    string,
    Map<number, { label: string; level: number; parent: number }>
  >();
  let sectionId = 0;
  let parentSectionId = 0;
  let currentSection:
    | { id: number; label: string; level: number; parent: number }
    | undefined;

  for (const line of content.split(/\r?\n/)) {
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      sectionId += 1;
      if (level === 2) parentSectionId = sectionId;
      currentSection =
        /^(?:synthesis|references|(?:primary\s+)?sources)\b/i.test(title)
          ? undefined
          : {
              id: sectionId,
              label: `${heading[1]} ${title}`,
              level,
              parent: level === 2 ? 0 : parentSectionId,
            };
      continue;
    }
    if (!currentSection) continue;
    for (const sourceUrl of declaredPrimarySourceUrls(line)) {
      const sections = declarations.get(sourceUrl) ?? new Map();
      sections.set(currentSection.id, currentSection);
      declarations.set(sourceUrl, sections);
    }
  }

  const duplicates: DuplicateSourceReference[] = [];
  for (const [sourceUrl, declaredSections] of declarations) {
    const peers = new Map<string, string[]>();
    for (const section of declaredSections.values()) {
      const peerKey = `${section.level}:${section.parent}`;
      const labels = peers.get(peerKey) ?? [];
      labels.push(section.label);
      peers.set(peerKey, labels);
    }
    for (const sections of peers.values()) {
      if (sections.length > 1) {
        duplicates.push({
          kind: "repeated-primary-source",
          output,
          sourceUrl,
          sections,
        });
      }
    }
  }
  return duplicates;
}

export function duplicateSourceReferences(
  outputs: string[],
  existingKnowledgeFiles: Set<string>,
  projectDir: string,
): DuplicateSourceReference[] {
  const knowledgeRoot = realpathSync(resolve(projectDir, "knowledge"));
  const currentFiles = realMarkdownFiles(knowledgeRoot);
  const urlIndex = new Map<string, Set<string>>();
  for (const path of currentFiles) {
    let content = "";
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const url of primarySourceUrls(content)) {
      const paths = urlIndex.get(url) ?? new Set<string>();
      paths.add(path);
      urlIndex.set(url, paths);
    }
  }

  const duplicates: DuplicateSourceReference[] = [];
  for (const output of outputs) {
    if (
      existingKnowledgeFiles.has(output) ||
      (output !== knowledgeRoot &&
        !output.startsWith(`${knowledgeRoot}${sep}`)) ||
      !output.endsWith(".md")
    ) {
      continue;
    }
    let content = "";
    try {
      content = readFileSync(output, "utf8");
    } catch {
      continue;
    }
    duplicates.push(...repeatedPrimarySourceReferences(output, content));
    for (const sourceUrl of primarySourceUrls(content)) {
      const existingFiles = [...(urlIndex.get(sourceUrl) ?? [])]
        .filter((path) => path !== output)
        .sort();
      if (existingFiles.length > 0) {
        duplicates.push({
          kind: "existing-file",
          output,
          sourceUrl,
          existingFiles,
        });
      }
    }
  }
  return duplicates.slice(0, 20);
}

function xhsObservation(
  packet: { query: string; items: XhsSearchItem[] },
  now: number,
): SourceObservation {
  const itemIdsOrUrls = [
    ...new Set(packet.items.map((item) => sanitizeSourceItem(item.id))),
  ].slice(0, 20);
  return {
    name: "xhs",
    queryOrFeed: packet.query,
    checkedAt: new Date(now).toISOString(),
    fingerprint: createHash("sha256")
      .update(JSON.stringify(itemIdsOrUrls))
      .digest("hex")
      .slice(0, 16),
    itemIdsOrUrls,
  };
}

function sourceResultEvidence(
  source: SourceObservation,
  provenance: "workflow" | "agent-result+workflow-time",
): string[] {
  return [
    `source-result:${JSON.stringify(source)}`,
    `source-provenance:${provenance}`,
  ];
}

export async function executeScoutExplore(
  ctx: WorkflowContext,
  dependencies: ScoutExploreDependencies = defaultDependencies,
): Promise<ExecutionResult> {
  const agent = "scout";
  if (!ctx.workspace || !ctx.reconciliation) {
    return ctx.blocked(
      "Scout exploration requires a canonical App task context",
    );
  }
  const appDir = ctx.workspace.appRoot;
  const projectDir = ctx.workspace.projectRoot;
  const source = sourceName(ctx.reconciliation.input);
  if (!source)
    return ctx.blocked("Scout exploration source is missing or unsupported");
  const now = Date.now();
  let xhsPacket: { query: string; items: XhsSearchItem[] } | undefined;
  let sourceEvidence: string[] = [];

  if (source === "xhs") {
    const credential = await dependencies.inspectXhsCredential(appDir);
    const waiting = xhsWaitResult(source, credential);
    if (waiting) return ctx.done(waiting.summary, waiting);

    const search = dependencies.searchXhs(appDir, defaultXhsQuery);
    sourceEvidence = [...xhsAccessEvidence(credential), ...search.evidence];
    if (search.state === "failed") {
      return ctx.blocked(`XHS search failed: ${search.reason}`, {
        facts: sourceEvidence,
      });
    }
    if (search.items.length === 0) {
      const summary = `XHS search for "${search.query}" returned no current source items; no artifact was created.`;
      const observation = xhsObservation(
        { query: search.query, items: [] },
        now,
      );
      return ctx.done(summary, {
        state: "converged",
        summary,
        facts: [
          ...sourceEvidence,
          ...sourceResultEvidence(observation, "workflow"),
          "result:evidence-backed-no-op",
        ],
        actions: [],
      } satisfies TaskHandlerResult);
    }
    xhsPacket = { query: search.query, items: search.items.slice(0, 20) };
  }

  // The task comes from the workflow-backed handler config — source-specific instructions
  const task = JSON.stringify(ctx.reconciliation, null, 2);
  const beforePublication = snapshotKnowledge(projectDir, ctx.workspace.output);
  const candidateFailureDetails = () => ({
    candidateFacts: retainedCandidateFacts(beforePublication),
    uncommittedChanges: changedKnowledgePaths(beforePublication),
  });
  const candidateProjectDir = beforePublication.projectRoot;
  const agentTask =
    buildExploreTask(
      task,
      { appDir, projectDir: candidateProjectDir },
      xhsPacket,
      source,
    ) +
    `\n\nPublication boundary: edit durable content only in ${candidateProjectDir}.
The final library root is ${beforePublication.canonicalProjectRoot}; use that
final root for links from the working digest or other workspaces, and relative
links within the library. Return candidate output paths for verification.
The workflow commits accepted bytes and returns final canonical paths. Do not
run Git publication or edit the canonical library in this call.`;
  const existingOutputSources = snapshotExistingOutputPrimarySources({
    appDir,
    projectDir: candidateProjectDir,
  });
  const knowledgeRoot = realpathSync(resolve(candidateProjectDir, "knowledge"));
  const existingKnowledgeFiles = new Set(
    [...existingOutputSources.keys()].filter(
      (path) =>
        path === knowledgeRoot || path.startsWith(`${knowledgeRoot}${sep}`),
    ),
  );

  const result = await ctx.agents.call(agent, agentTask, {
    schema: ExploreAgentResultSchema,
    // Source retrieval, duplicate checks, integration and read-back exceeded
    // the default 24 operations in a real cycle. Keep one bounded call and
    // the existing time limit; do not add a workflow-owned continuation loop.
    operationAllowance: 48,
  });

  if (result.status !== "done") {
    return ctx.blocked("Scout exploration session failed", {
      executionId: result.id,
      status: result.status,
      summary: result.summary,
      ...candidateFailureDetails(),
    });
  }
  // Execution "done" means the call returned, not that its work succeeded.
  // The existing finish evidence preserves an explicitly partial outcome.
  const finish = result.facts;
  if (
    finish &&
    typeof finish === "object" &&
    "status" in finish &&
    finish.status === "partial"
  ) {
    return ctx.blocked("Scout exploration is incomplete, not a no-op", {
      executionId: result.id,
      summary: result.summary,
      finish,
      ...candidateFailureDetails(),
    });
  }
  const structured = result.output as ExploreAgentResult | undefined;
  if (!structured || !Array.isArray(structured.outputs)) {
    return ctx.blocked(
      "Scout exploration did not return a structured source result",
      {
        executionId: result.id,
        ...candidateFailureDetails(),
      },
    );
  }
  const observationAdmission =
    source === "xhs" && xhsPacket
      ? ({
          ok: true,
          observation: xhsObservation(xhsPacket, now),
        } satisfies SourceObservationAdmission)
      : admitSourceObservation(structured.source, source, Date.now());
  if ("invalidField" in observationAdmission) {
    return ctx.blocked(
      "Scout exploration returned invalid current-source evidence",
      {
        source,
        invalidField: observationAdmission.invalidField,
        reason: observationAdmission.reason,
        executionId: result.id,
        ...candidateFailureDetails(),
      },
    );
  }
  const observation = observationAdmission.observation;
  const outputs = admittedOutputPaths(structured.outputs, {
    appDir,
    projectDir: candidateProjectDir,
  });
  if (!outputs) {
    return ctx.blocked(
      "Scout exploration returned a missing output or an output outside the allowed roots",
      { outputs: structured.outputs, ...candidateFailureDetails() },
    );
  }
  if (
    outputs.length > 0 &&
    !outputs.some((output) => output.startsWith(`${knowledgeRoot}${sep}`))
  ) {
    return ctx.blocked(
      "Scout draft preserved; library integration is incomplete",
      {
        executionId: result.id,
        summary: structured.summary,
        source: observation,
        outputs,
        ...candidateFailureDetails(),
      },
    );
  }
  const replacements = replacedExistingOutputs(outputs, existingOutputSources);
  if (replacements.length > 0) {
    return ctx.blocked(
      "Scout exploration removed primary sources from an existing output",
      {
        replacements,
        executionId: result.id,
        ...candidateFailureDetails(),
      },
    );
  }
  const duplicateReferences = duplicateSourceReferences(
    outputs,
    existingKnowledgeFiles,
    candidateProjectDir,
  );
  if (duplicateReferences.length > 0) {
    return ctx.blocked(
      "Scout exploration created a finding with duplicate source references",
      {
        duplicates: duplicateReferences,
        executionId: result.id,
        ...candidateFailureDetails(),
      },
    );
  }
  const durableChanges = changedKnowledgePaths(beforePublication);
  const omittedOutputs = durableChanges.filter(
    (path) => !outputs.includes(path),
  );
  if (omittedOutputs.length > 0) {
    return ctx.blocked("Scout exploration omitted changed durable outputs", {
      executionId: result.id,
      outputs,
      uncommittedChanges: durableChanges,
      omittedOutputs,
      candidateFacts: retainedCandidateFacts(beforePublication),
    });
  }
  let publication;
  // Scratch/digest paths passed the existing App-workspace admission above.
  // They remain readable outputs, but are not versioned library content.
  const scratchOutputs = outputs.filter(
    (path) => !path.startsWith(`${candidateProjectDir}${sep}`),
  );
  try {
    publication = publishKnowledgeChanges(beforePublication, {
      executionId: result.id,
      summary: structured.summary,
      reportedOutputs: outputs.filter((path) => !scratchOutputs.includes(path)),
    });
  } catch (error) {
    const retained = retainAcceptedPublication(error, {
      summary:
        "Scout exploration was accepted and retained for publication recovery.",
      facts: [
        ...sourceEvidence,
        ...sourceResultEvidence(
          observation,
          source === "xhs" ? "workflow" : "agent-result+workflow-time",
        ),
        `execution:${result.id}`,
      ],
    });
    if (retained) return ctx.done(retained.summary, retained);
    return ctx.blocked("Scout exploration was accepted but not published", {
      executionId: result.id,
      outputs,
      ...candidateFailureDetails(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return ctx.done(structured.summary, {
    state: "converged",
    summary: structured.summary,
    facts: [
      ...new Set([
        ...sourceEvidence,
        ...sourceResultEvidence(
          observation,
          source === "xhs" ? "workflow" : "agent-result+workflow-time",
        ),
        ...[...publication.outputs, ...scratchOutputs].map(
          (output) => `output:${output}`,
        ),
        ...publicationFacts(publication),
        ...(outputs.length === 0 ? ["result:evidence-backed-no-op"] : []),
        `execution:${result.id}`,
      ]),
    ],
    actions: [],
  } satisfies TaskHandlerResult);
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  return executeScoutExplore(ctx);
}
