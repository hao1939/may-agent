import { meaningfulTaskDetail } from "./task-evidence-identity.js";
import { taskReviewValidity } from "./task-assessment-context.js";
import {
  readPinnedArtifact,
  type Artifact,
  type ArtifactRead,
} from "../../../../../../shared/tools/task-evidence.js";
import type { PublicTaskEvidenceProvider } from "./public-task-evidence.js";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Follow references, never directory scans, prose paths or unbounded transcripts.
 * Shared artifact references also cover development records, helper reports and
 * raw verification receipts. The bundle is evidence, not a recovery verdict. */
export async function readPinnedTaskEvidence(
  appId: string,
  taskId: string,
  task: { appTask: Record<string, unknown>; detail: Record<string, unknown> },
  provider: Pick<PublicTaskEvidenceProvider, "getAppTask" | "getTask">,
) {
  const artifacts: Array<ArtifactRead & { source: string }> = [];
  const links: Array<Record<string, unknown>> = [];
  const gaps = new Set<string>();
  const files = new Set<string>();
  const tasks = new Set<string>([`${appId}\0${taskId}`]);
  const queue: Array<{ value: unknown; source: string; depth: number }> = [
    { value: task, source: "subject", depth: 0 },
  ];
  const pendingTasks: Array<{ appId: string; taskId: string }> = [];
  let bytesRemaining = 65_536;
  let nodes = 0;
  function enqueueTask(appId: string, taskId: string) {
    const key = `${appId}\0${taskId}`;
    if (tasks.has(key)) return;
    tasks.add(key);
    if (appId.toLowerCase().replace(/\.app$/, "") === "evaluation") {
      gaps.add(
        `Evaluation-owned link excluded from semantic evidence: ${appId}/${taskId}`,
      );
      return;
    }
    if (pendingTasks.length >= 4) {
      gaps.add("linked-task limit (4); remaining references not read");
      return;
    }
    pendingTasks.push({ appId, taskId });
  }
  function navigation(
    owner: string,
    appTask: Record<string, unknown>,
    detail: Record<string, unknown>,
  ) {
    const diagnostics = object(detail.diagnostics);
    if (
      detail.historyTruncated ||
      diagnostics.dependenciesTruncated ||
      diagnostics.conditionsTruncated
    )
      gaps.add(
        `public Task navigation truncated: ${owner}/${String(appTask.id)}`,
      );
    if (detail.historyError)
      gaps.add(
        `public Task history unavailable: ${owner}/${String(appTask.id)}`,
      );
    for (const id of Array.isArray(appTask.dependsOn) ? appTask.dependsOn : [])
      if (typeof id === "string") enqueueTask(owner, id);
    for (const dependency of Array.isArray(diagnostics.dependencies)
      ? diagnostics.dependencies
      : []) {
      const link = object(dependency);
      if (typeof link.id === "string" && link.status !== "group")
        enqueueTask(owner, link.id);
    }
  }
  navigation(appId, task.appTask, task.detail);
  // Current reads stay compact. Explicitly page immutable accepted attempts so
  // pinned evidence remains reachable after many later wait-only results.
  let evidenceCursor = "";
  let evidencePages = 0;
  try {
    do {
      const historical = await provider.getTask(appId, taskId, {
        limit: 8,
        ...(evidenceCursor ? { cursor: evidenceCursor } : {}),
      });
      const navigation = object(historical.acceptedEvidence);
      const page = object(navigation.page);
      if (!navigation.page || !Array.isArray(page.items))
        throw new Error("accepted-attempt page unsupported or malformed");
      const items = page.items;
      for (const item of items) {
        const record = object(item);
        queue.push({
          value: record.acceptedResult,
          source: `accepted-attempt:${String(record.appId)}/${String(record.taskId)}:${String(record.taskGeneration)}:${String(record.attemptId)}`,
          depth: 0,
        });
        if (record.truncated)
          gaps.add(
            `accepted attempt content truncated: ${String(record.attemptId)}`,
          );
      }
      evidenceCursor =
        typeof page.nextCursor === "string" ? page.nextCursor : "";
      evidencePages += 1;
    } while (evidenceCursor && evidencePages < 16);
    if (evidenceCursor)
      gaps.add(
        "accepted-attempt navigation limit (128 records); older evidence not read",
      );
  } catch {
    gaps.add(`accepted-attempt history unavailable: ${appId}/${taskId}`);
  }
  let linkedIndex = 0;
  for (
    let index = 0;
    index < queue.length || linkedIndex < pendingTasks.length;
    index++
  ) {
    if (index >= queue.length) {
      const link = pendingTasks[linkedIndex++]!;
      try {
        const appTask = await provider.getAppTask(link.appId, link.taskId);
        const detail = await provider.getTask(link.appId, link.taskId);
        if (
          appTask.generation !== undefined &&
          detail.generation !== undefined &&
          appTask.generation !== detail.generation
        )
          throw new Error("generation mismatch");
        const evidence = meaningfulTaskDetail(detail);
        const validity = taskReviewValidity(appTask, evidence);
        const bytes = Buffer.byteLength(
          JSON.stringify({ appTask, detail: evidence, validity }),
        );
        if (bytes > Math.min(32_768, bytesRemaining)) {
          links.push({ ...link, status: "truncated", bytes });
          gaps.add(`linked Task truncated: ${link.appId}/${link.taskId}`);
        } else {
          bytesRemaining -= bytes;
          links.push({
            ...link,
            status: "read",
            appTask,
            detail: evidence,
            validity,
          });
          queue.push({
            value: appTask.result,
            source: `task:${link.appId}/${link.taskId}.result`,
            depth: 0,
          });
          if (
            detail.historyTruncated ||
            object(detail.diagnostics).dependenciesTruncated
          )
            gaps.add(
              `linked Task navigation truncated: ${link.appId}/${link.taskId}`,
            );
        }
      } catch {
        links.push({ ...link, status: "unavailable" });
        gaps.add(`linked Task unavailable: ${link.appId}/${link.taskId}`);
      }
      // Process the new queue item (if any), otherwise try the next link.
      index--;
      continue;
    }
    if (++nodes > 2_000) {
      gaps.add(
        "reference scan limit (2000 nodes); remaining references not read",
      );
      break;
    }
    const { value, source, depth } = queue[index]!;
    if (!value || typeof value !== "object") continue;
    if (depth > 12) {
      gaps.add(`reference depth limit: ${source}`);
      continue;
    }
    const item = object(value);
    if (typeof item.path === "string") {
      if (
        typeof item.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(item.sha256)
      ) {
        const reference: Artifact = { path: item.path, sha256: item.sha256 };
        const key = `${reference.path}\0${reference.sha256}`;
        if (!files.has(key)) {
          files.add(key);
          if (artifacts.length >= 12)
            gaps.add("artifact limit (12); remaining references not read");
          else {
            const read = await readPinnedArtifact(
              reference,
              Math.min(32_768, bytesRemaining),
            );
            artifacts.push({ ...read, source });
            if (read.status !== "read")
              gaps.add(`artifact ${read.status}: ${reference.path}`);
            else {
              bytesRemaining -= read.bytes!;
              if (reference.path.endsWith(".json")) {
                try {
                  queue.push({
                    value: JSON.parse(read.content!),
                    source: reference.path,
                    depth: depth + 1,
                  });
                } catch {
                  gaps.add(`artifact JSON unreadable: ${reference.path}`);
                }
              }
            }
          }
        }
      } else gaps.add(`unpinned path not read: ${item.path}`);
    }
    // Exact structured cross-App helper references; no guesses from session IDs.
    // The canonical creator object remains in the subject snapshot as provenance,
    // but its mutable Task is not itself outcome evidence. Do not mark it visited:
    // the same identity must still be followed if a result/dependency cites it.
    const creatorProvenance =
      source === "subject.appTask.creator" ||
      source.startsWith("subject.appTask.creator.");
    if (
      !creatorProvenance &&
      typeof item.appId === "string" &&
      typeof item.taskId === "string"
    )
      enqueueTask(item.appId, item.taskId);
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object")
        queue.push({
          value: child,
          source: `${source}.${key}`,
          depth: depth + 1,
        });
    }
  }
  return {
    version: 1,
    limits: {
      artifacts: 12,
      artifactBytes: 32_768,
      totalArtifactBytes: 65_536,
      linkedTasks: 4,
      acceptedAttempts: 128,
      acceptedPageSize: 8,
      scanNodes: 2_000,
    },
    artifacts,
    links,
    gaps: [...gaps],
  };
}
