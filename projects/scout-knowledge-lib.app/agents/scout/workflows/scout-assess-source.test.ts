import { afterEach, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { admitTaskReconcileResult, type WorkflowContext } from "@may-agent/sdk";
import { Check } from "typebox/value";
import app, { taskForScoutInput } from "../../../app";
import { execute, executeSourceAssessment } from "./scout-assess-source";
import { assessmentRecord, saveAssessment } from "./lib/assessment-archive";
import {
  coverageEvidence,
  extractSource,
  readSource,
  selectExcerpts,
  sourceIdentity,
  type SourcePacket,
} from "./lib/assessment-source";

it("extracts the actual PDF fixture through the provisioned reader", async () => {
  const bytes = readFileSync(
    new URL("./fixtures/source-assessment.pdf", import.meta.url),
  );
  const pages = await extractSource(bytes);
  expect(pages).toHaveLength(1);
  expect(pages[0]).toBe("Controlled PDF evidence.");
});

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function temporary() {
  const root = mkdtempSync(join(tmpdir(), "scout-assessment-"));
  roots.push(root);
  mkdirSync(join(root, "knowledge"), { recursive: true });
  writeFileSync(join(root, "knowledge/README.md"), "# Knowledge\n");
  execFileSync("git", ["init", "-b", "main"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root,
  });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });
  return root;
}
const sourceUrl = "https://arxiv.org/pdf/2508.10874";
const input = {
  kind: "assess-source",
  data: {
    sourceUrl,
    outcome: "Assess the paper",
    acceptance: ["Useful findings and honest limits"],
    archive: true,
  },
};
const draft = {
  title: "A paper assessment",
  summary: "Useful idea, with limited evidence.",
  assessment:
    "The authors report an improvement. The supplied evidence does not establish causation.",
  state: "converged" as "converged" | "incomplete",
  reuseExisting: false,
};
const packet: SourcePacket = {
  requestedUrl: sourceUrl,
  identity: sourceIdentity(sourceUrl),
  retrievedUrl: sourceUrl,
  retrievedAt: "2026-09-16T00:00:00Z",
  sha256: "synthetic-fixture",
  format: "pdf",
  totalCharacters: 100,
  totalPages: 2,
  excerpts: [{ page: 1, start: 0, end: 10, text: "Some text." }],
};
function context(
  root: string,
  call: WorkflowContext["call"],
  data = input.data,
) {
  const current = { ...input, data };
  return createTestAppWorkflowContext({
    input: current,
    reconciliation: {
      task: {
        id: "goal/test",
        parentId: "",
        status: "running",
        generation: 1,
        resourceVersion: 1,
        agent: "scout",
        outcome: data.outcome,
        acceptance: data.acceptance,
        input: current,
        conditions: [],
        acceptedEvidence: { available: true, maxPageSize: 2 },
      },
      appId: "scout-knowledge-lib",
      taskId: "goal/test",
      generation: 1,
      resourceVersion: 1,
      agent: "scout",
      owner: "scout",
      outcome: data.outcome,
      acceptance: data.acceptance,
      input: current,
      children: { live: [], completed: [] },
      waits: { open: [], note: "No retained waits" },
      taskSnapshot: { live: [], truncated: false },
      events: { items: [], truncated: false },
    },
    workspace: {
      appRoot: root,
      projectRoot: root,
      root,
      output: join(root, "output"),
    },
    call,
  });
}
const success = (output = draft) => ({
  id: "s_assess",
  kind: "agent" as const,
  status: "done" as const,
  summary: output.summary,
  output,
});

it("admits a source operation and binds its code procedure without changing generic goals", () => {
  expect(typeof execute).toBe("function");
  expect(Check(app.inputSchema, input)).toBe(true);
  expect(
    Check(app.inputSchema, {
      ...input,
      data: { ...input.data, archive: undefined },
    }),
  ).toBe(false);
  expect(
    Check(app.inputSchema, {
      ...input,
      data: { ...input.data, sourceUrl: "file:///tmp/paper" },
    }),
  ).toBe(false);
  const task = taskForScoutInput({
    id: "request",
    source: { kind: "app", id: "may" },
    input,
  });
  expect(task).toMatchObject({
    kind: "desired",
    intent: { workflow: "scout-assess-source", input },
  });
  const generic = taskForScoutInput({
    id: "request",
    source: { kind: "app", id: "may" },
    input: { ...input, kind: "goal" },
  });
  expect(generic).toHaveProperty("intent.workflow", "knowledge-planner");
});

it("supplies bounded excerpts with exact offsets, including the tail", () => {
  const pages = ["0123456789", "abcdefghij", "ABCDEFGHIJ"];
  const excerpts = selectExcerpts(pages, 16);
  expect(excerpts.map((span) => span.text).join("")).toBe("0123456789abGHIJ");
  for (const span of excerpts)
    expect(span.text).toBe(pages[span.page - 1].slice(span.start, span.end));
  expect(
    selectExcerpts(pages, 30)
      .map((span) => span.text)
      .join(""),
  ).toBe(pages.join(""));
  expect(
    sourceIdentity("https://arxiv.org/abs/2508.10874v2?utm_source=mail"),
  ).toBe(packet.identity);
  expect(sourceIdentity("https://example.org/post?id=3&utm_source=mail")).toBe(
    "https://example.org/post?id=3",
  );
});

it("the procedure saves and reads back the analysis with code-owned coverage", async () => {
  const root = temporary();
  let options: unknown;
  const ctx = context(root, (async (_agent, prompt, suppliedOptions) => {
    options = suppliedOptions;
    expect(prompt).toContain(JSON.stringify(packet));
    return success();
  }) as WorkflowContext["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(options).toMatchObject({ tools: "readonly" });
  expect(result.output).toHaveProperty("state", "converged");
  expect(admitTaskReconcileResult(result.output).ok).toBe(true);
  const record = assessmentRecord(root, sourceUrl);
  const saved = readFileSync(record.path, "utf8");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  expect(structuredClone(result.output)).toMatchObject({
    facts: expect.arrayContaining([
      `publication:commit:${revision}`,
      `output:${record.path}`,
    ]),
  });
  expect(
    execFileSync(
      "git",
      ["show", `${revision}:${record.path.slice(root.length + 1)}`],
      { cwd: root, encoding: "utf8" },
    ),
  ).toBe(saved);
  expect(saved).toContain(draft.assessment);
  expect(saved).toContain("Supplied 10 of 100");
  const evidence = JSON.parse(saved.split("```json\n")[1].split("\n```")[0]);
  expect(evidence).toEqual(coverageEvidence(packet));
  expect(result.output).toHaveProperty(
    "response",
    expect.stringContaining(record.path),
  );
});

it("a changed question reuses the source record and retains previous evidence", async () => {
  const root = temporary();
  await executeSourceAssessment(
    context(root, (async () => success()) as WorkflowContext["call"]),
    async () => packet,
  );
  const first = assessmentRecord(root, sourceUrl);
  const next = context(
    root,
    (async (_agent, prompt) => {
      expect(prompt).toContain(draft.assessment);
      expect(prompt).toContain("Focus on limitations");
      return success({
        ...draft,
        assessment: "Corrected assessment: the claim remains unverified.",
      });
    }) as WorkflowContext["call"],
    { ...input.data, outcome: "Focus on limitations" },
  );
  const result = await executeSourceAssessment(next, async () => packet);
  expect(result.output).toHaveProperty("state", "converged");
  const second = assessmentRecord(root, sourceUrl);
  expect(second.path).toBe(first.path);
  expect(second.previous).toContain(first.previous.trim());
  expect(second.previous.indexOf("Corrected assessment")).toBeLessThan(
    second.previous.indexOf("Earlier assessments"),
  );
  expect(second.previous).toContain("Corrected assessment");
  expect(readdirSync(join(root, "knowledge/findings"))).toHaveLength(1);
});

function head(root: string) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}
function candidateRecord(root: string) {
  const parent = join(root, "output/.state/scout-publication");
  const candidates = readdirSync(parent).filter((name) =>
    name.startsWith("scout-knowledge-candidate-"),
  );
  expect(candidates).toHaveLength(1);
  return assessmentRecord(join(parent, candidates[0]), sourceUrl);
}

it("a fitting assessment is reused without new bytes, history or a Git commit", async () => {
  const root = temporary();
  await executeSourceAssessment(
    context(root, (async () => success()) as WorkflowContext["call"]),
    async () => packet,
  );
  const first = assessmentRecord(root, sourceUrl);
  const revision = head(root);
  const result = await executeSourceAssessment(
    context(root, (async (_agent, prompt) => {
      expect(prompt).toContain(first.previous);
      return success({ ...draft, reuseExisting: true });
    }) as WorkflowContext["call"]),
    async () => packet,
  );
  expect(structuredClone(result.output)).toMatchObject({
    state: "converged",
    facts: expect.arrayContaining([
      `output:${first.path}`,
      "publication:no-change",
      `publication-head:${revision}`,
    ]),
    response: expect.stringContaining(
      `Verified publication revision: ${revision}`,
    ),
  });
  expect(assessmentRecord(root, sourceUrl)).toEqual(first);
  expect(head(root)).toBe(revision);
  expect(readdirSync(join(root, "knowledge/findings"))).toHaveLength(1);
});

it.each(["absent", "changed bytes", "symlink", "another candidate file"])(
  "invalid reuse (%s) retains the candidate without publishing it",
  async (failure) => {
    const root = temporary();
    if (failure !== "absent") {
      await executeSourceAssessment(
        context(root, (async () =>
          success()) as WorkflowContext["call"]),
        async () => packet,
      );
    }
    const revision = head(root);
    let existing: string | undefined;
    if (failure !== "absent")
      existing = assessmentRecord(root, sourceUrl).previous;
    const result = await executeSourceAssessment(
      context(root, (async () => {
        const record = candidateRecord(root);
        if (failure === "changed bytes")
          writeFileSync(
            record.path,
            record.previous + "\nUnreviewed candidate edit\n",
          );
        if (failure === "another candidate file")
          writeFileSync(
            join(dirname(dirname(record.path)), "README.md"),
            "Unreviewed unrelated edit",
          );
        if (failure === "symlink") {
          rmSync(record.path);
          symlinkSync(join(root, "knowledge/README.md"), record.path);
        }
        return success({ ...draft, reuseExisting: true });
      }) as WorkflowContext["call"]),
      async () => packet,
    );
    expect(structuredClone(result.output)).toMatchObject({
      state: "incomplete",
      facts: expect.arrayContaining([
        expect.stringContaining("archive-failure:"),
        expect.stringContaining("candidate-root:"),
      ]),
    });
    const facts = (result.output as { facts: string[] }).facts;
    expect(
      facts.some(
        (fact) => fact.startsWith("publication:") || fact.startsWith("output:"),
      ),
    ).toBe(false);
    expect(head(root)).toBe(revision);
    if (existing)
      expect(assessmentRecord(root, sourceUrl).previous).toBe(existing);
    else expect(readdirSync(join(root, "knowledge"))).toEqual(["README.md"]);
  },
);

it("a partial finish preserves its new gap even when it asks to reuse an older record", async () => {
  const root = temporary();
  await executeSourceAssessment(
    context(root, (async () => success()) as WorkflowContext["call"]),
    async () => packet,
  );
  const previous = assessmentRecord(root, sourceUrl).previous;
  const result = await executeSourceAssessment(
    context(root, (async () => ({
      ...success({ ...draft, reuseExisting: true }),
      facts: {
        status: "partial",
        blockers: [{ reason: "The governing reference is still unread.", context: "Pending access" }],
      },
    })) as WorkflowContext["call"]),
    async () => packet,
  );
  expect(result.output).toHaveProperty("state", "incomplete");
  const saved = assessmentRecord(root, sourceUrl).previous;
  expect(saved).toContain("The governing reference is still unread.");
  expect(saved).toContain(previous.trim());
});

it("standalone no-save uses its assignment without reconciliation or a workspace", async () => {
  let calls = 0;
  const ctx = createTestAppWorkflowContext({
    input: { ...input, data: { ...input.data, archive: false } },
    call: (async (_agent, prompt) => {
      calls++;
      expect(prompt).toContain(input.data.outcome);
      return success();
    }) as WorkflowContext["call"],
  });
  ctx.reconciliation = undefined;
  ctx.workspace = undefined;
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(calls).toBe(1);
  expect(structuredClone(result.output)).toMatchObject({
    state: "converged",
    facts: expect.arrayContaining(["archive:disabled-by-assignment"]),
  });
});

it("the hosted assignment overrides conflicting procedure input", async () => {
  const root = temporary();
  const ctx = context(root, (async (_agent, prompt) => {
    expect(prompt).toContain(input.data.outcome);
    expect(prompt).not.toContain("Conflicting request");
    return success();
  }) as WorkflowContext["call"]);
  ctx.input = {
    kind: "assess-source",
    data: {
      ...input.data,
      sourceUrl: "https://example.org/wrong",
      outcome: "Conflicting request",
    },
  };
  const result = await executeSourceAssessment(ctx, async (url) => {
    expect(url).toBe(sourceUrl);
    return packet;
  });
  expect(result.output).toHaveProperty("state", "converged");
});

it("missing hosted assignment cannot fall back to a caller's procedure input", async () => {
  const root = temporary();
  let calls = 0;
  let reads = 0;
  const ctx = context(root, (async () => {
    calls++;
    return success();
  }) as WorkflowContext["call"]);
  ctx.reconciliation!.input = undefined as never;
  const result = await executeSourceAssessment(ctx, async () => {
    reads++;
    return packet;
  });
  expect(calls).toBe(0);
  expect(reads).toBe(0);
  expect(result.output).toHaveProperty("state", "incomplete");
  expect(readdirSync(root)).toEqual([".git", "knowledge"]);
});

it("no-save performs the assessment without creating archive files", async () => {
  const root = temporary();
  const ctx = context(
    root,
    (async () => success()) as WorkflowContext["call"],
    { ...input.data, archive: false },
  );
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "converged");
  expect(readdirSync(root)).toEqual([".git", "knowledge"]);
  expect(result.output).toHaveProperty(
    "response",
    expect.stringContaining("No assessment was archived"),
  );
  expect(result.output).toHaveProperty(
    "response",
    expect.stringContaining(draft.assessment),
  );
});

it("an aborted attempt cannot save a late model result", async () => {
  const root = temporary();
  const controller = new AbortController();
  const ctx = context(root, (async () => {
    controller.abort(new Error("Assignment changed"));
    return success();
  }) as WorkflowContext["call"]);
  ctx.signal = controller.signal;
  await expect(
    executeSourceAssessment(ctx, async () => packet),
  ).rejects.toThrow("Assignment changed");
  expect(() => readdirSync(join(root, "knowledge/findings"))).toThrow();
});

it("an actual HTTP denial reaches the same bounded judgment and publication pipeline", async () => {
  const root = temporary();
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("Forbidden", { status: 403 }),
  });
  let calls = 0;
  try {
    const url = `http://127.0.0.1:${server.port}/post`;
    const ctx = context(
      root,
      (async (_agent, prompt) => {
        calls++;
        expect(prompt).toContain("HTTP 403");
        expect(prompt).toContain(
          "source content and any unrecorded redirect remain unknown",
        );
        expect(prompt).toContain("Classify the source's availability");
        return success({
          ...draft,
          summary: "Availability classified: access denied.",
          assessment:
            "The exact URL returned HTTP 403. No body was read. Further reading needs permitted source access; the cause of the denial is unknown.",
        });
      }) as WorkflowContext["call"],
      {
        ...input.data,
        sourceUrl: url,
        outcome: "Classify the source's availability",
        acceptance: [
          "A recorded access failure is an acceptable classification; do not infer its cause.",
        ],
      },
    );
    const result = await executeSourceAssessment(ctx);
    expect(calls).toBe(1);
    expect(structuredClone(result.output)).toMatchObject({
      state: "converged",
      facts: expect.arrayContaining([
        "source-access-failure:Source retrieval returned HTTP 403",
        expect.stringContaining("publication:commit:"),
      ]),
    });
    const saved = assessmentRecord(root, url).previous;
    expect(saved).toContain("No body was read");
    expect(saved).toContain("Request fulfillment: converged");
    const evidence = JSON.parse(saved.split("```json\n")[1].split("\n```")[0]);
    expect(evidence).toMatchObject({
      requestedUrl: url,
      identity: sourceIdentity(url),
      error: "Source retrieval returned HTTP 403",
    });
    expect(evidence).not.toHaveProperty("retrievedUrl");
  } finally {
    server.stop(true);
  }
});

it("an unusable draft preserves only an access receipt after retrieval failure", async () => {
  const root = temporary();
  let calls = 0;
  const ctx = context(root, (async () => {
    calls++;
    return {
      ...success(),
      status: "error",
      output: undefined,
      summary: "No usable model result",
    };
  }) as WorkflowContext["call"]);
  const result = await executeSourceAssessment(ctx, async () => {
    throw new Error("HTTP 404");
  });
  expect(calls).toBe(1);
  expect(result.output).toHaveProperty("state", "incomplete");
  const saved = assessmentRecord(root, sourceUrl).previous;
  expect(saved).toContain("## Access attempt");
  expect(saved).toContain("not a substantive assessment");
  expect(saved).toContain("HTTP 404");
  expect(saved).not.toContain(draft.assessment);
});

it("concurrent edits prevent a successful save and preserve the existing content", async () => {
  const root = temporary();
  const record = assessmentRecord(root, sourceUrl);
  saveAssessment(record, sourceUrl, "Existing note", "Earlier assessment");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "existing assessment"], { cwd: root });
  const ctx = context(root, (async () => {
    writeFileSync(
      record.path,
      readFileSync(record.path, "utf8") + "\nHuman correction\n",
    );
    return success();
  }) as WorkflowContext["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(structuredClone(result.output)).toMatchObject({
    state: "waiting",
    facts: expect.arrayContaining([
      expect.stringContaining("accepted-publication:pending:"),
      expect.stringContaining("candidate-ref:refs/archive/scout-publication/"),
    ]),
    requests: [expect.objectContaining({ appId: "scout-knowledge-lib" })],
    conditions: [{ requestId: (result.output as any).requests[0].id }],
  });
  expect(readFileSync(record.path, "utf8")).toContain("Human correction");
  expect(readFileSync(record.path, "utf8")).not.toContain(draft.assessment);
});

it("partial analysis is saved with its limits and cannot fulfill the research", async () => {
  const root = temporary();
  const ctx = context(root, (async () =>
    success({
      ...draft,
      state: "incomplete",
    })) as WorkflowContext["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "incomplete");
  expect(assessmentRecord(root, sourceUrl).previous).toContain(
    draft.assessment,
  );
});

// Controlled drafts test orchestration and evidence guards, not live model judgment.
const xhsUrl = "https://www.xiaohongshu.com/explore/6aab4f5f0000000028029fa8";
const loginPacket: SourcePacket = {
  ...packet,
  requestedUrl: xhsUrl,
  identity: sourceIdentity(xhsUrl),
  retrievedUrl:
    "https://www.rednote.com/login?redirectPath=https%3A%2F%2Fwww.rednote.com%2Fexplore%2F6aab4f5f0000000028029fa8",
  totalCharacters: 6,
  totalPages: 1,
  excerpts: [{ page: 1, start: 0, end: 6, text: "Log in" }],
};
it.each([
  {
    name: "availability classification",
    outcome: "Classify this source",
    acceptance: "Record an observed access restriction as a valid disposition.",
    state: "converged",
    archive: true,
  },
  {
    name: "non-English acceptance",
    outcome: "判断这篇帖子的访问情况",
    acceptance: "若无法读取，记录实际观察和未读内容，即满足本次分类要求。",
    state: "converged",
    archive: true,
  },
  {
    name: "required full-body reading",
    outcome: "Review the complete post body",
    acceptance:
      "The complete body must be read; an access disposition does not fulfill this request.",
    state: "incomplete",
    archive: true,
  },
  {
    name: "explicit no-save classification",
    outcome: "Classify this source without saving",
    acceptance:
      "An observed access limitation is sufficient; do not save a record.",
    state: "converged",
    archive: false,
  },
] as const)(
  "honors the supplied request judgment for $name while preserving identical access evidence",
  async ({ outcome, acceptance, state, archive }) => {
    const root = temporary();
    let calls = 0;
    const ctx = context(
      root,
      (async (_agent, prompt) => {
        calls++;
        expect(prompt).toContain(acceptance);
        expect(prompt).toContain(JSON.stringify(loginPacket));
        return success({
          ...draft,
          state,
          summary: "The requested source reached a login screen.",
          assessment:
            "The post body was not read. The observed login screen is the only content available. Further body reading requires authorized access to the same source.",
        });
      }) as WorkflowContext["call"],
      { sourceUrl: xhsUrl, outcome, acceptance: [acceptance], archive },
    );
    const result = await executeSourceAssessment(ctx, async () => loginPacket);
    expect(calls).toBe(1);
    expect(structuredClone(result.output)).toMatchObject({
      state,
      response: expect.stringContaining("post body was not read"),
    });
    expect(admitTaskReconcileResult(result.output).ok).toBe(true);
    if (archive) {
      expect(assessmentRecord(root, xhsUrl).previous).toContain(
        `Request fulfillment: ${state}`,
      );
      expect(result.output).toHaveProperty(
        "facts",
        expect.arrayContaining([
          expect.stringContaining("publication:commit:"),
        ]),
      );
    } else {
      expect(readdirSync(root)).toEqual([".git", "knowledge"]);
    }
  },
);

it.each([
  { requestedUrl: "https://example.org/different-source" },
  { identity: "https://example.org/different-source" },
])(
  "rejects a packet with mismatched assigned identity before Scout runs: %j",
  async (mismatch) => {
    const root = temporary();
    let calls = 0;
    const ctx = context(root, (async () => {
      calls++;
      return success();
    }) as WorkflowContext["call"]);
    const result = await executeSourceAssessment(ctx, async () => ({
      ...packet,
      ...mismatch,
    }));
    expect(calls).toBe(0);
    expect(structuredClone(result.output)).toMatchObject({
      state: "incomplete",
      summary: expect.stringContaining("does not match the assigned identity"),
    });
    expect(readdirSync(join(root, "knowledge"))).toEqual(["README.md"]);
  },
);

it("preserves the current Host-normalized blocked partial draft", async () => {
  const root = temporary();
  const ctx = context(root, (async () => ({
    id: "s_normalized_partial",
    kind: "agent",
    status: "blocked",
    summary: "A usable draft needs repository evidence.",
    output: { ...draft, state: "incomplete" },
    facts: {
      status: "partial",
      blockers: [{ reason: "Read implementation and tests.", context: "Need repository access" }],
    },
  })) as WorkflowContext["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  const record = assessmentRecord(root, sourceUrl);
  expect(structuredClone(result.output)).toMatchObject({
    state: "incomplete",
    facts: expect.arrayContaining([
      "execution:s_normalized_partial",
      "execution-status:blocked",
      expect.stringContaining("Read implementation and tests."),
      `output:${record.path}`,
    ]),
    response: expect.stringContaining(draft.assessment),
  });
  expect(record.previous).toContain(draft.assessment);
});

it.each([
  { state: "incomplete", status: "done", partial: true },
  { state: "converged", status: "done", partial: true },
  { state: "converged", status: "error", partial: false },
] as const)(
  "preserves the draft without convergence for $status, partial=$partial, draft.state=$state",
  async ({ state, status, partial }) => {
    const root = temporary();
    const ctx = context(root, (async () => ({
      ...success({ ...draft, state }),
      status,
      facts: {
        ...(partial ? { status: "partial" } : {}),
        blockers: [{ reason: "Implementation and test results were not inspected.", context: "Missing evidence" }],
      },
    })) as WorkflowContext["call"]);
    const result = await executeSourceAssessment(ctx, async () => packet);
    const record = assessmentRecord(root, sourceUrl);
    expect(result.output).toHaveProperty("state", "incomplete");
    expect(result.output).toHaveProperty(
      "response",
      expect.stringContaining(record.path),
    );
    expect(record.previous).toContain(draft.assessment);
    expect(record.previous).toContain("Request incomplete.");
    expect(record.previous).toContain(
      "Implementation and test results were not inspected.",
    );
    expect(record.previous).toContain("Supplied 10 of 100");
  },
);

it("a completed call without a draft cannot produce or publish an assessment", async () => {
  const root = temporary();
  const revision = head(root);
  const ctx = context(root, (async () => {
    const record = candidateRecord(root);
    writeFileSync(record.path, "Unreviewed candidate content");
    return {
      id: "s_no_draft",
      kind: "agent",
      status: "done",
      summary: "No usable draft",
      facts: { status: "partial" },
    };
  }) as WorkflowContext["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "incomplete");
  expect(() => readdirSync(join(root, "knowledge/findings"))).toThrow();
  expect(head(root)).toBe(revision);
  expect(result.output).toHaveProperty(
    "facts",
    expect.arrayContaining([expect.stringContaining("candidate-root:")]),
  );
});

it("reads a real HTTP post, excludes scripts, and reports retrieval failure", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: (req) =>
      new URL(req.url).pathname === "/post"
        ? new Response(
            "<html><body><h1>Post</h1><p>Actual evidence.</p><script>Not content</script></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          )
        : new Response("missing", { status: 404 }),
  });
  try {
    const source = await readSource(`http://127.0.0.1:${server.port}/post`);
    expect(source.format).toBe("text");
    expect(source.excerpts.map((span) => span.text).join("")).toBe(
      "Post\nActual evidence.",
    );
    await expect(
      readSource(`http://127.0.0.1:${server.port}/missing`),
    ).rejects.toThrow("HTTP 404");
  } finally {
    server.stop(true);
  }
});

it("an unsafe canonical target never produces a successful result or a claimed saved path", async () => {
  const root = temporary();
  const record = assessmentRecord(root, sourceUrl);
  const ctx = context(root, (async () => {
    mkdirSync(record.path); // A conflicting filesystem object appears during analysis.
    return success();
  }) as WorkflowContext["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(structuredClone(result.output)).toMatchObject({
    state: "waiting",
    facts: expect.arrayContaining([
      expect.stringContaining("accepted-publication:pending:"),
      expect.stringContaining("candidate-ref:refs/archive/scout-publication/"),
    ]),
    requests: [expect.objectContaining({ appId: "scout-knowledge-lib" })],
    conditions: [{ requestId: (result.output as any).requests[0].id }],
  });
  expect(result.output).toHaveProperty(
    "facts",
    expect.not.arrayContaining([`output:${record.path}`]),
  );
});

it("retains source links using the retrieved page URL without following them", async () => {
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (req) => {
      const path = new URL(req.url).pathname;
      requests.push(path);
      if (path === "/start")
        return Response.redirect(new URL("/repo/", req.url));
      return new Response(
        '<html><body><a href="../paper?v=2">Paper</a><a href="https://docs.example.org/primer">Documentation</a><a href="javascript:evil()">Bad link</a><script>Not evidence</script></body></html>',
        {
          headers: { "content-type": "text/html" },
        },
      );
    },
  });
  try {
    const packet = await readSource(`http://127.0.0.1:${server.port}/start`);
    const text = packet.excerpts.map((s) => s.text).join("");
    expect(text).toContain(
      `Paper\n(http://127.0.0.1:${server.port}/paper?v=2)`,
    );
    expect(text).toContain("Documentation\n(https://docs.example.org/primer)");
    expect(text).not.toContain("javascript:");
    expect(text).not.toContain("Not evidence");
    expect(requests).toEqual(["/start", "/repo/"]);
  } finally {
    server.stop(true);
  }
});

it("preserves plain-text code and Markdown instead of treating them as HTML", async () => {
  const source =
    "function identity<T>(value: T): T { return value; }\nSee [guide](https://example.org/guide).\nLiteral <script> remains text.";
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(source, { headers: { "content-type": "text/plain" } }),
  });
  try {
    const packet = await readSource(
      `http://127.0.0.1:${server.port}/source.ts`,
    );
    expect(packet.excerpts.map((s) => s.text).join("")).toBe(source);
    expect(packet.totalCharacters).toBe(source.length);
  } finally {
    server.stop(true);
  }
});
