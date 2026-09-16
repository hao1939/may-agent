import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type TaskIntent,
} from "@may-agent/sdk";
import { xhsCredentialObserver } from "./watchers/xhs-credential.js";

const projectId = "scout-knowledge-lib";
const appDir = "/app/projects/scout-knowledge-lib.app";
const projectDir = "/app/projects/scout-knowledge-lib";
const actionInputSchema = Type.Object({}, { additionalProperties: true });

function eventParams(params: unknown): Record<string, unknown> {
  return params && typeof params === "object" && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {};
}

function eventDetails(event: Record<string, unknown>): Record<string, unknown> {
  const data = eventParams(event.data);
  return {
    ...eventParams(event.target),
    ...eventParams(data.params),
    ...Object.fromEntries(
      Object.entries(event).filter(
        ([key]) => !["data", "target"].includes(key),
      ),
    ),
    // Canonical event metadata describes the producer. Domain payload fields
    // such as Scout's research source must remain authoritative.
    ...data,
  };
}

function scoutEvent(
  type: string,
  data: unknown = {},
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data: { project: projectId, ...eventParams(data) },
    target: { appId: projectId, project: projectId },
  };
}

function ownerRequested(
  reason: string,
  params: unknown = {},
): AppEvent<Record<string, unknown>> {
  return scoutEvent("project.owner.requested", {
    reason,
    ...eventParams(params),
  });
}

const scoutSources = new Set(["arxiv", "hn", "xhs", "github", "reddit"]);
const ownerReviewReasons = new Set([
  "experience-review",
  "library-health-signal",
  "project-comment",
  "manual-library-review",
  "repair-index",
  "owner-message",
  "evaluation-session-finding",
]);

export function resolveScoutTask(
  event: Record<string, unknown>,
): TaskIntent | null {
  const details = eventDetails(event);
  switch (event.type) {
    case "scout.explore": {
      const source = String(
        details.researchSource ?? details.source ?? event.source ?? "",
      ).toLowerCase();
      if (!scoutSources.has(source)) return null;
      return {
        id: `explore-${source}`,
        parentId: "ongoing-research",
        outcome: `Continuously explore ${source} for source-grounded AI-agent signals and integrate useful findings into the Scout knowledge library.`,
        acceptance: [
          "The current source is checked without simulated data; useful findings update an existing note or a source-grounded finding, otherwise the workflow records an evidence-backed no-op.",
        ],
        workflow: "scout-explore",
        input: { source },
        outputs: [
          `${projectDir}/knowledge`,
          `${appDir}/agents/scout/workspace/digest/today.md`,
        ],
        priority: source === "xhs" ? "P2" : "P1",
      };
    }
    case "scout.digest":
      return {
        id: "daily-digest",
        parentId: "ongoing-research",
        outcome:
          "Keep daily Scout findings preserved and handed to May for a useful shared-Conversation digest.",
        acceptance: [
          "Current findings are preserved in an immutable snapshot and handed to May through the supported App message route, or the workflow records that there are no findings. Do not claim provider delivery; preserve accumulator changes that arrive during handoff.",
        ],
        workflow: "scout-daily-digest",
        outputs: [`${appDir}/agents/scout/workspace/digest`],
        priority: "P1",
      };
    case "project.library_health.tick":
      return {
        id: "runtime/library-health-observer",
        parentId: "library-operations",
        outcome:
          "Keep a deterministic observation of the Scout library shape and wake its owner only for meaningful maintenance signals.",
        acceptance: [
          "A current library-health packet is recorded and meaningful signals produce one owner wake.",
        ],
        workflow: "library-health",
        outputs: [`${appDir}/.state/library-health-packets.jsonl`],
        priority: "P1",
      };
    case "project.comment.created":
    case "project.owner.requested": {
      const reason = String(details.reason ?? "");
      if (
        event.type === "project.owner.requested" &&
        !ownerReviewReasons.has(reason)
      )
        return null;
      return {
        id: "library-maintenance",
        parentId: "library-operations",
        outcome:
          "Keep the Scout knowledge library coherent, source-grounded, navigable, and organized around its most useful next maintenance step.",
        acceptance: [
          "Scout performs one useful maintenance step or records an evidence-backed no-op without creating duplicate project work.",
        ],
        workflow: "knowledge-planner",
        outputs: [
          `${projectDir}/knowledge`,
          `${projectDir}/reports`,
          `${appDir}/agents/scout/workspace/digest/today.md`,
        ],
        priority: "P1",
      };
    }
    default:
      return null;
  }
}

function scoutMetricInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const details = eventDetails(event as unknown as Record<string, unknown>);
  const owner = String(event.owner ?? details.owner ?? "");
  const metricId = String(
    details.metricId ?? details.metric_id ?? details.metric ?? "",
  );
  if (
    owner !== "scout" &&
    owner !== "agent:scout" &&
    !metricId.startsWith("scout.")
  ) {
    return null;
  }
  return {
    kind: "owner-review",
    data: { reason: "library-health-signal", metric: details },
  };
}

const nonBlankText = Type.String({ minLength: 1, pattern: "\\S" });
const scoutInputSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("goal"),
      data: Type.Object(
        {
          outcome: nonBlankText,
          acceptance: Type.Array(nonBlankText, { minItems: 1 }),
          constraints: Type.Optional(Type.Array(nonBlankText)),
        },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("explore"),
      data: Type.Object(
        {
          source: Type.Union([
            Type.Literal("arxiv"),
            Type.Literal("hn"),
            Type.Literal("xhs"),
            Type.Literal("github"),
            Type.Literal("reddit"),
          ]),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Union([
        Type.Literal("owner-review"),
        Type.Literal("library-health"),
        Type.Literal("digest"),
      ]),
      data: Type.Record(Type.String(), Type.Unknown()),
    },
    { additionalProperties: false },
  ),
]);

function scoutInput(kind: AppInput["kind"], data: unknown): AppInput {
  return { kind, data: eventParams(data) };
}

export function evaluationOwnerRequestedInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const details = eventDetails(event as unknown as Record<string, unknown>);
  const finding = eventParams(details.finding);
  const evidence = finding.evidence;
  if (
    event.source !== "agent:evaluator" ||
    details.project !== projectId ||
    details.reason !== "evaluation-session-finding" ||
    typeof details.sourceSessionId !== "string" ||
    details.sourceSessionId.trim().length === 0 ||
    finding.targetAppId !== projectId ||
    typeof finding.dedupeKey !== "string" ||
    finding.dedupeKey.trim().length === 0 ||
    finding.requestedHumanAction !== "none" ||
    typeof finding.message !== "string" ||
    finding.message.trim().length === 0 ||
    !Array.isArray(evidence) ||
    evidence.length === 0 ||
    evidence.some(
      (item) => typeof item !== "string" || item.trim().length === 0,
    )
  ) {
    return null;
  }
  return scoutInput("owner-review", details);
}

export function libraryHealthObservedInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const details = eventDetails(event as unknown as Record<string, unknown>);
  const wakeCount = details.wakeCount;
  const wakeSignals = details.wakeSignals;
  const packetPath = details.packetPath;
  if (
    !Number.isInteger(wakeCount) ||
    Number(wakeCount) < 0 ||
    !Array.isArray(wakeSignals) ||
    typeof packetPath !== "string" ||
    packetPath.trim().length === 0
  ) {
    return null;
  }
  if (Number(wakeCount) === 0 && wakeSignals.length === 0) return null;
  if (
    Number(wakeCount) !== wakeSignals.length ||
    wakeSignals.length === 0 ||
    wakeSignals.some(
      (signal) =>
        !signal ||
        typeof signal !== "object" ||
        Array.isArray(signal) ||
        typeof (signal as Record<string, unknown>).key !== "string" ||
        typeof (signal as Record<string, unknown>).fingerprint !== "string",
    )
  ) {
    return null;
  }
  return scoutInput("owner-review", {
    reason: "library-health-signal",
    packetPath,
    signalCount: wakeCount,
    signals: wakeSignals,
    observedEventType: event.type,
  });
}

function intentForScoutInput(input: AppInput): TaskIntent | null {
  const data = eventParams(input.data);
  switch (input.kind) {
    case "digest":
      return resolveScoutTask({ type: "scout.digest" });
    case "owner-review":
      return resolveScoutTask(
        scoutEvent("project.owner.requested", data) as unknown as Record<
          string,
          unknown
        >,
      );
    case "library-health":
      return resolveScoutTask(
        scoutEvent("project.library_health.tick", data) as unknown as Record<
          string,
          unknown
        >,
      );
    case "explore":
      return resolveScoutTask(
        scoutEvent("scout.explore", data) as unknown as Record<string, unknown>,
      );
    default:
      return null;
  }
}

export function taskForScoutInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  if (admitted.input.kind === "goal") {
    const data = eventParams(admitted.input.data);
    if (
      typeof data.outcome !== "string" ||
      !data.outcome.trim() ||
      !Array.isArray(data.acceptance) ||
      data.acceptance.length === 0 ||
      data.acceptance.some((item) => typeof item !== "string" || !item.trim())
    )
      throw new Error("Scout goal requires outcome and acceptance");
    return {
      kind: "desired",
      intent: {
        id: `goal/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
        parentId: "library-operations",
        outcome: data.outcome.trim(),
        acceptance: data.acceptance as string[],
        agent: "scout",
        input: { kind: "goal", data },
        outputs: [
          `${projectDir}/knowledge`,
          `${projectDir}/reports`,
          `${appDir}/agents/scout/workspace/digest/today.md`,
        ],
        priority: "P1",
      },
    };
  }
  const intent = intentForScoutInput(admitted.input);
  if (!intent) {
    throw new Error(
      admitted.input.kind === "explore"
        ? "Scout explore requires source: arxiv, hn, xhs, github or reddit; use goal with outcome and acceptance for an exact source assessment"
        : `Unsupported Scout input: ${admitted.input.kind}`,
    );
  }
  return { kind: "desired", intent };
}

export default defineApp({
  id: projectId,
  version: 1,
  agent: "scout",
  description:
    "Scout research and knowledge app: discovers AI trends from arXiv, HN, XHS, GitHub, Reddit; synthesizes findings into a source-grounded knowledge library; delivers daily digests. Use goal (outcome, acceptance, optional constraints and context references) for a specific paper, post or question; it reads and archives the assessment even without new topic knowledge. Use explore (source: arxiv|hn|xhs|github|reddit) only for a standing feed scan.",
  workspace: {
    kind: "local",
    localPath: "../scout-knowledge-lib",
  },
  inputSchema: scoutInputSchema,
  task: taskForScoutInput,
  subscriptions: [
    {
      id: "project-comment",
      event: { type: "project.comment.created", project: projectId },
      toInput(event) {
        return scoutInput("owner-review", {
          reason: "project-comment",
          ...eventDetails(event as unknown as Record<string, unknown>),
        });
      },
    },
    {
      id: "project-owner-request",
      event: { type: "project.owner.requested", project: projectId },
      toInput(event) {
        const details = eventDetails(
          event as unknown as Record<string, unknown>,
        );
        if (details.reason === "evaluation-session-finding") {
          return evaluationOwnerRequestedInput(event);
        }
        return ownerReviewReasons.has(String(details.reason ?? ""))
          ? scoutInput("owner-review", details)
          : null;
      },
    },
    {
      id: "library-health-observed-actionable",
      event: {
        type: "project.library_health.observed",
        project: projectId,
        source: `app-task:${projectId}`,
      },
      toInput: libraryHealthObservedInput,
    },
    {
      id: "scout-metric-breach",
      event: { type: "metric.breach" },
      toInput: scoutMetricInput,
    },
    {
      id: "xhs-credential-attention",
      event: { type: "credential.state", project: projectId },
      toInput(event) {
        const details = eventDetails(
          event as unknown as Record<string, unknown>,
        );
        return details.credential === "xhs" && details.state === "unavailable"
          ? scoutInput("owner-review", {
              reason: "library-health-signal",
              credential: details,
            })
          : null;
      },
    },
  ],
  observations: ["project.knowledge.maintained"],
  observers: [xhsCredentialObserver],

  schedules: [
    {
      id: "owner-review",
      enabled: true,
      intervalMs: 86_400_000,
      event: ownerRequested("experience-review", {
        instruction:
          "Daily knowledge-library owner review: inspect current library needs and the bounded reconciliation-history packet. Choose ordinary maintenance, at most one finite process improvement or investigation task, or an evidence-backed no-op. Do not create standalone projects.",
        reviewChecklist: [
          "When useful, read recent findings, connect sources, identify one non-obvious implication, update canonical knowledge, and verify the output. Synthesis is optional; do not manufacture it.",
          "Look for stale or duplicate findings, missing index coverage, and knowledge entries that need rollup.",
          "Look for exact repeated failures, agent handoffs, or evidence-backed no-ops that may justify one reusable improvement.",
          "Check the current tree before proposing work and do not duplicate a live task.",
          "No-op is valid when existing exploration and maintenance tasks already cover the useful next work.",
        ],
      }),
    },
    {
      id: "scout-explore-arxiv",
      enabled: true,
      intervalMs: 14_400_000, // 4h
      event: scoutEvent("scout.explore", { source: "arxiv" }),
    },
    {
      id: "scout-explore-hn",
      enabled: true,
      intervalMs: 7_200_000, // 2h
      event: scoutEvent("scout.explore", { source: "hn" }),
    },
    {
      id: "scout-explore-xhs",
      enabled: true,
      intervalMs: 14_400_000, // 4h
      event: scoutEvent("scout.explore", { source: "xhs" }),
    },
    {
      id: "scout-explore-github",
      enabled: true,
      intervalMs: 7_200_000, // 2h
      event: scoutEvent("scout.explore", { source: "github" }),
    },
    {
      id: "scout-explore-reddit",
      enabled: true,
      intervalMs: 14_400_000, // 4h
      event: scoutEvent("scout.explore", { source: "reddit" }),
    },
    {
      id: "scout-daily-digest",
      enabled: true,
      intervalMs: 86_400_000, // 24h
      event: scoutEvent("scout.digest"),
    },
    {
      id: "library-health",
      enabled: true,
      intervalMs: 21_600_000, // 6h
      event: scoutEvent("project.library_health.tick"),
    },
  ],

  tasks: {
    maxConcurrent: 1,
    subscriptions: [
      { type: "scout.explore", project: projectId },
      { type: "scout.digest", project: projectId },
      { type: "project.library_health.tick", project: projectId },
    ],
    resolve: resolveScoutTask,
  },

  actions: {
    "digest-now": {
      description:
        "Preserve current findings and ask May to present a research digest.",
      inputSchema: Type.Object({}, { additionalProperties: false }),
      toInput() {
        return scoutInput("digest", {});
      },
    },
    "review-library": {
      description:
        "Ask Scout to review the knowledge library and update it if useful.",
      inputSchema: actionInputSchema,
      toInput(params) {
        return scoutInput("owner-review", {
          reason: "manual-library-review",
          ...eventParams(params),
        });
      },
    },
    "repair-index": {
      description:
        "Ask Scout to repair knowledge/INDEX.md and related navigation.",
      inputSchema: actionInputSchema,
      toInput(params) {
        return scoutInput("owner-review", {
          reason: "repair-index",
          ...eventParams(params),
        });
      },
    },
    "health-check": {
      description:
        "Run the deterministic library-health observer and wake Scout if maintenance signals are found.",
      inputSchema: actionInputSchema,
      toInput(params) {
        return scoutInput("library-health", params);
      },
    },
    "explore-now": {
      description:
        "Trigger a scout exploration for a specific source (arxiv, hn, xhs, github, reddit).",
      inputSchema: Type.Object(
        {
          source: Type.Optional(
            Type.Union([
              Type.Literal("arxiv"),
              Type.Literal("hn"),
              Type.Literal("xhs"),
              Type.Literal("github"),
              Type.Literal("reddit"),
            ]),
          ),
        },
        { additionalProperties: false },
      ),
      toInput(params) {
        const source =
          params && typeof params === "object" && "source" in params
            ? String((params as Record<string, unknown>).source ?? "arxiv")
            : "arxiv";
        return scoutInput("explore", { source });
      },
    },
  },
});
