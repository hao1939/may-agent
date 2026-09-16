import { afterEach, expect, it } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  complete: true,
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
  call: WorkflowContext["agents"]["call"],
  data = input.data,
) {
  const current = { ...input, data };
  return createTestAppWorkflowContext({
    input: current,
    reconciliation: {
      appId: "scout-knowledge-lib",
      taskId: "goal/test",
      generation: 1,
      resourceVersion: 1,
      agent: "scout",
      outcome: data.outcome,
      acceptance: data.acceptance,
      input: current,
      children: { live: [], completed: [] },
    },
    workspace: {
      appRoot: root,
      projectRoot: root,
      root,
      output: join(root, "output"),
    },
    callAgent: call,
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
  expect(generic).not.toHaveProperty("intent.workflow");
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
  }) as WorkflowContext["agents"]["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(options).toMatchObject({ tools: "readonly" });
  expect(result.output).toHaveProperty("state", "converged");
  expect(
    admitTaskReconcileResult(result.output, { allowNeedsAgent: true }).ok,
  ).toBe(true);
  const record = assessmentRecord(root, sourceUrl);
  const saved = readFileSync(record.path, "utf8");
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
    context(root, (async () => success()) as WorkflowContext["agents"]["call"]),
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
    }) as WorkflowContext["agents"]["call"],
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

it("no-save performs the assessment without creating archive files", async () => {
  const root = temporary();
  const ctx = context(
    root,
    (async () => success()) as WorkflowContext["agents"]["call"],
    { ...input.data, archive: false },
  );
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "converged");
  expect(readdirSync(root)).toEqual([]);
  expect(result.output).toHaveProperty(
    "response",
    expect.stringContaining("No assessment was archived"),
  );
});

it("an aborted attempt cannot save a late model result", async () => {
  const root = temporary();
  const controller = new AbortController();
  const ctx = context(root, (async () => {
    controller.abort(new Error("Assignment changed"));
    return success();
  }) as WorkflowContext["agents"]["call"]);
  ctx.signal = controller.signal;
  await expect(
    executeSourceAssessment(ctx, async () => packet),
  ).rejects.toThrow("Assignment changed");
  expect(readdirSync(join(root, "knowledge/findings"))).toEqual([]);
});

it("source failure records access limits and leaves research incomplete without a model call", async () => {
  const root = temporary();
  const ctx = context(root, (async () => {
    throw new Error("Must not run");
  }) as WorkflowContext["agents"]["call"]);
  const result = await executeSourceAssessment(ctx, async () => {
    throw new Error("HTTP 404");
  });
  expect(result.output).toHaveProperty("state", "incomplete");
  expect(assessmentRecord(root, sourceUrl).previous).toContain(
    "No source text was supplied",
  );
});

it("concurrent edits prevent a successful save and preserve the existing content", async () => {
  const root = temporary();
  const record = assessmentRecord(root, sourceUrl);
  saveAssessment(record, sourceUrl, "Existing note", "Earlier assessment");
  const ctx = context(root, (async () => {
    writeFileSync(
      record.path,
      readFileSync(record.path, "utf8") + "\nHuman correction\n",
    );
    return success();
  }) as WorkflowContext["agents"]["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "incomplete");
  expect(result.output).toHaveProperty(
    "summary",
    expect.stringContaining("changed during research"),
  );
  expect(readFileSync(record.path, "utf8")).toContain("Human correction");
  expect(readFileSync(record.path, "utf8")).not.toContain(draft.assessment);
});

it("partial analysis is saved with its limits and cannot fulfill the research", async () => {
  const root = temporary();
  const ctx = context(root, (async () =>
    success({
      ...draft,
      complete: false,
    })) as WorkflowContext["agents"]["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "incomplete");
  expect(assessmentRecord(root, sourceUrl).previous).toContain(
    draft.assessment,
  );
});

it.each([false, true])(
  "preserves a partial finish draft without convergence even when draft.complete=%s",
  async (complete) => {
    const root = temporary();
    const ctx = context(root, (async () => ({
      ...success({ ...draft, complete }),
      facts: {
        status: "partial",
        next_steps: "Implementation and test results were not inspected.",
      },
    })) as WorkflowContext["agents"]["call"]);
    const result = await executeSourceAssessment(ctx, async () => packet);
    const record = assessmentRecord(root, sourceUrl);
    expect(result.output).toHaveProperty("state", "incomplete");
    expect(result.output).toHaveProperty(
      "response",
      expect.stringContaining(record.path),
    );
    expect(record.previous).toContain(draft.assessment);
    expect(record.previous).toContain("Assessment incomplete.");
    expect(record.previous).toContain(
      "Implementation and test results were not inspected.",
    );
    expect(record.previous).toContain("Supplied 10 of 100");
  },
);

it("a completed call without a draft cannot produce an assessment", async () => {
  const root = temporary();
  const ctx = context(root, (async () => ({
    id: "s_no_draft",
    kind: "agent",
    status: "done",
    summary: "No usable draft",
    facts: { status: "partial" },
  })) as WorkflowContext["agents"]["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "incomplete");
  expect(readdirSync(join(root, "knowledge/findings"))).toEqual([]);
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

it("a save failure never produces a successful result or a claimed saved path", async () => {
  const root = temporary();
  const record = assessmentRecord(root, sourceUrl);
  const ctx = context(root, (async () => {
    mkdirSync(record.path); // A conflicting filesystem object appears during analysis.
    return success();
  }) as WorkflowContext["agents"]["call"]);
  const result = await executeSourceAssessment(ctx, async () => packet);
  expect(result.output).toHaveProperty("state", "incomplete");
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
