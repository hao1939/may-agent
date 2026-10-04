import { readFileSync } from "node:fs";
import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";
import {
  packetHash,
  trustedDecisionFromEvent,
  type ApprovalPacket,
  type ApprovalProposal,
  type TrustedApprovalEvent,
} from "../../../improvement-approval.js";
import {
  readSubjectTask,
  sendPublicReadCommand,
} from "../../../../alex.app/agents/evaluator/workflows/lib/public-task-evidence.js";
import {
  currentProposalMatches,
  inspectApplication,
  type ApplicationFiles,
} from "../../../scripts/apply-improvement.js";

export const name = "improvement-activation-follow-up";
export const description =
  "Recheck the exact trusted approval and applied source receipt, request the approved pinned App-definition reload, read its correlated live source identity, then request independent Alex-hosted evaluation of a concrete new subject Task.";

type Input = {
  files: ApplicationFiles;
  proposal: ApprovalProposal;
  approvalEventId: number;
  sourceReceipt: string;
  newSubjectTask: { appId: string; taskId: string; generation: number };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function publicEvidenceProvider() {
  const { createPublicTaskEvidenceProvider } =
    await import("../../../../alex.app/agents/evaluator/workflows/lib/public-task-evidence.js");
  return createPublicTaskEvidenceProvider();
}

type PublicRead = typeof sendPublicReadCommand;

async function readCorrelatedReloadResult(
  retained: { eventId: number; data: Record<string, unknown> },
  provider: EvidenceProvider,
  requestId: string,
  expectedRequest: Record<string, unknown>,
  publicRead: PublicRead,
) {
  for (const [key, value] of Object.entries(expectedRequest)) {
    if (retained.data[key] !== value)
      throw new Error(`retained reload request ${key} changed`);
  }
  const response = await publicRead({
    type: "event.get",
    eventId: retained.eventId,
  });
  if (response.command !== "event.get")
    throw new Error("reload request public read identity mismatch");
  const envelope = record(response.event);
  const request = record(envelope.event);
  const publicData = record(request.data);
  if (
    Number(request.id) !== retained.eventId ||
    request.type !== "runtime.reload.requested" ||
    Object.entries(expectedRequest).some(
      ([key, value]) => publicData[key] !== value,
    )
  )
    throw new Error(
      "retained reload request no longer matches public evidence",
    );
  const operations = (Array.isArray(envelope.links) ? envelope.links : [])
    .map(record)
    .filter((link) => link.kind === "operation");
  if (operations.length === 0)
    return { requested: true, event: undefined } as const;
  if (operations.length !== 1 || !/^event:\d+$/.test(String(operations[0]!.id)))
    throw new Error("reload request has ambiguous correlated operations");
  const eventId = Number(String(operations[0]!.id).slice("event:".length));
  const event = await provider.getEvent(eventId);
  if (
    event.type !== "runtime.reload.finished" ||
    event.source !== "runtime" ||
    record(event.data).requestId !== requestId
  )
    throw new Error("reload operation link does not name its exact completion");
  return { requested: true, eventId, event } as const;
}

function sourceReceiptMatches(
  path: string,
  packet: ApprovalPacket,
  proposal: ApprovalProposal,
  eventId: number,
): boolean {
  const receipt = record(JSON.parse(readFileSync(path, "utf8")));
  const authority = record(receipt.authority);
  return (
    receipt.stage === "source-application" &&
    receipt.applied === true &&
    receipt.appliedCommit === packet.candidateCommit &&
    authority.kind === "trusted-journal-event" &&
    Number(authority.eventId) === eventId &&
    authority.packetHash === packet.packetHash &&
    authority.proposalHash === proposal.proposalHash &&
    authority.conditionId === proposal.conditionId
  );
}

type EvidenceProvider = Awaited<ReturnType<typeof publicEvidenceProvider>>;

type SelectedFollowUp = {
  dependencyId: string;
  requestIds: string[];
  appId: string;
  taskId: string;
  generation: number;
  evidenceHash: string;
};

async function acceptedFollowUpSelection(
  ctx: WorkflowContext<Input>,
  taskId: string,
  packetHash: string,
): Promise<SelectedFollowUp | null> {
  const task = await ctx.read.tasks.get(taskId);
  if (!task) return null;
  const result = record(task.result);
  if (
    result.stage !== "post-adoption-evaluation-requested" ||
    result.packetHash !== packetHash
  )
    return null;
  const subject = record(result.newSubject);
  const dependencyId = String(result.dependencyId ?? "");
  const appId = String(subject.appId ?? "");
  const selectedTaskId = String(subject.taskId ?? "");
  const generation = Number(subject.generation);
  const evidenceHash = String(subject.evidenceHash ?? "");
  const requestIds = task.conditions
    .filter(
      (condition) =>
        condition.type === "app.dependency.updated" &&
        condition.owner === "app:alex" &&
        condition.subject.startsWith("id:"),
    )
    .map((condition) => condition.subject.slice("id:".length));
  for (const wait of ctx.reconciliation?.waits?.open ?? []) {
    if (
      wait.type === "app.dependency.updated" &&
      wait.dependency?.appId === "alex" &&
      wait.subject.startsWith("id:")
    )
      requestIds.push(wait.subject.slice("id:".length));
  }
  return dependencyId &&
    appId &&
    selectedTaskId &&
    generation > 0 &&
    /^[0-9a-f]{64}$/.test(evidenceHash)
    ? {
        dependencyId,
        requestIds: [...new Set(requestIds.filter(Boolean))],
        appId,
        taskId: selectedTaskId,
        generation,
        evidenceHash,
      }
    : null;
}

export async function runActivationFollowUp(
  ctx: WorkflowContext<Input>,
  suppliedProvider?: EvidenceProvider,
  publicRead: PublicRead = sendPublicReadCommand,
): Promise<ExecutionResult> {
  const rec = ctx.reconciliation;
  if (!rec?.taskId)
    return ctx.blocked(
      "Activation composition requires an ordinary owner Task",
    );
  try {
    if (rec.taskId !== ctx.input.proposal.task.taskId)
      return ctx.blocked(
        "Activation denied: approval belongs to a different owner Task",
      );
    const inputRequestId = `improvement-activation:${ctx.input.proposal.packetHash}`;
    const retainedRequest = await ctx.events.read(
      "runtime.reload.requested",
      inputRequestId,
    );
    let packet: ApprovalPacket | undefined;
    let expectedRequest: Record<string, unknown>;
    if (retainedRequest) {
      // Once the exact operation is durably issued, it is the continuation
      // authority. Mutable preparation files cannot erase or widen it.
      expectedRequest = Object.fromEntries(
        [
          "requestId",
          "expectedSourceCommit",
          "approvalEventId",
          "packetHash",
          "proposalHash",
          "taskId",
          "taskGeneration",
          "conditionId",
        ].map((key) => [key, retainedRequest.data[key]]),
      );
    } else {
      packet = JSON.parse(
        readFileSync(ctx.input.files.packet, "utf8"),
      ) as ApprovalPacket;
      const { packetHash: claimedPacketHash, ...packetBody } = packet;
      if (
        packetHash(packetBody) !== claimedPacketHash ||
        packet.packetHash !== ctx.input.proposal.packetHash
      )
        return ctx.blocked("Activation denied: approval packet changed");
      const inspected = inspectApplication(ctx.input.files);
      if (packet.candidateCommit !== inspected.current.baselineCommit)
        return ctx.blocked(
          "Activation denied: source checkout is not the exact applied candidate",
        );
      if (!packet.activation)
        return ctx.blocked(
          "Activation denied: approved packet is source-application-only",
        );
      if (
        packet.activation.appId !== "may-agent" ||
        packet.activation.operation !== "runtime.reload.requested" ||
        packet.activation.target !== "installed-app-definitions"
      )
        return ctx.blocked("Activation denied: unsupported approved operation");
      expectedRequest = {
        requestId: inputRequestId,
        expectedSourceCommit: packet.candidateCommit,
        approvalEventId: ctx.input.approvalEventId,
        packetHash: packet.packetHash,
        proposalHash: ctx.input.proposal.proposalHash,
        taskId: rec.taskId,
        taskGeneration: ctx.input.proposal.task.generation,
        conditionId: ctx.input.proposal.conditionId,
      };
    }
    const requestId = String(expectedRequest.requestId);
    const approvedPacketHash = String(expectedRequest.packetHash);
    const approvedSourceCommit = String(expectedRequest.expectedSourceCommit);
    if (
      requestId !== inputRequestId ||
      expectedRequest.packetHash !== ctx.input.proposal.packetHash ||
      expectedRequest.proposalHash !== ctx.input.proposal.proposalHash ||
      expectedRequest.taskId !== rec.taskId ||
      expectedRequest.taskGeneration !== ctx.input.proposal.task.generation ||
      expectedRequest.conditionId !== ctx.input.proposal.conditionId ||
      expectedRequest.approvalEventId !== ctx.input.approvalEventId ||
      !/^[0-9a-f]{40}$/.test(String(expectedRequest.expectedSourceCommit))
    )
      return ctx.blocked(
        "Activation denied: issued operation identity changed",
      );

    const provider = suppliedProvider ?? (await publicEvidenceProvider());
    const owner = await provider.getTask(
      ctx.input.proposal.task.appId,
      ctx.input.proposal.task.taskId,
    );
    const sameActiveOwner =
      (owner.taskId === rec.taskId || owner.id === rec.taskId) &&
      owner.generation === ctx.input.proposal.task.generation &&
      ["pending", "waiting", "running", "attention"].includes(
        String(owner.status),
      ) &&
      owner.terminal !== true;
    if (
      retainedRequest
        ? !sameActiveOwner
        : !currentProposalMatches(owner, ctx.input.proposal)
    )
      return ctx.blocked(
        retainedRequest
          ? "Activation denied: issued operation no longer belongs to the active owner generation"
          : "Activation denied: approval proposal is no longer the exact owner wait",
      );
    if (!retainedRequest) {
      if (!packet) throw new Error("approval packet was not loaded");
      await trustedDecisionFromEvent(
        packet,
        ctx.input.proposal,
        ctx.input.approvalEventId,
        async (id) =>
          (await provider.getEvent(id)) as unknown as TrustedApprovalEvent,
      ).then((decision) => {
        if (decision.decision !== "approved")
          throw new Error(`human decision is ${decision.decision}`);
      });
      if (
        !sourceReceiptMatches(
          ctx.input.sourceReceipt,
          packet,
          ctx.input.proposal,
          ctx.input.approvalEventId,
        )
      )
        return ctx.blocked(
          "Activation denied: actual source-application receipt does not bind the trusted approval",
        );
      await ctx.events.emit({
        type: "runtime.reload.requested",
        owner: "agent:may",
        localKey: requestId,
        data: {
          ...expectedRequest,
          reason: `Activate exact approved packet ${approvedPacketHash}`,
        },
      } as never);
    }
    const finished = retainedRequest
      ? await readCorrelatedReloadResult(
          retainedRequest,
          provider,
          requestId,
          expectedRequest,
          publicRead,
        )
      : { event: undefined as undefined };
    if (!finished.event) {
      const summary =
        "Exact approval and source receipt verified; waiting for the correlated pinned App-definition reload result.";
      return ctx.done(summary, {
        state: "waiting",
        summary,
        facts: [
          `source-application:${ctx.input.sourceReceipt}`,
          `activation-request:${requestId}`,
        ],
        result: {
          stage: "activation-requested",
          packetHash: approvedPacketHash,
          requestId,
          nextOwner: "app:may-agent",
          nextAction: "Return the correlated pinned reload result.",
        },
        conditions: [
          {
            id: requestId,
            type: "runtime.reload.finished",
            subject: `requestId:${requestId}`,
            expected: { requestId },
            owner: "app:may-agent",
            reviewAfterMs: 60_000,
          },
        ],
      } satisfies TaskReconcileResult);
    }

    const result = record(finished.event.data);
    if (result.ok !== true || result.sourceCommit !== approvedSourceCommit) {
      const summary = `Live adoption is ${result.ok === false ? "failed" : "inconclusive"}; the improvement remains open.`;
      return ctx.done(summary, {
        state: "incomplete",
        summary,
        response: summary,
        facts: [
          `activation-request:${requestId}`,
          `activation-result-event:${finished.eventId ?? "unavailable"}`,
        ],
        result: {
          stage:
            result.ok === false
              ? "activation-failed"
              : "activation-inconclusive",
          packetHash: approvedPacketHash,
          actualSourceCommit: result.sourceCommit ?? null,
          nextOwner: "app:may-agent",
          nextAction: "Repair or clarify live adoption before follow-up.",
        },
      } satisfies TaskReconcileResult);
    }

    // The owner's accepted result pins the exact selected follow-up. Never
    // resample mutable subject state when a dependency return arrives.
    const selected = await acceptedFollowUpSelection(
      ctx,
      rec.taskId,
      approvedPacketHash,
    );
    if (selected) {
      // The current Task Conditions carry Runtime's opaque admitted request IDs.
      // Events only wake reconciliation; they never replace this current-state
      // mapping or the subject identity already retained by the owner.
      const candidates = await Promise.all(
        selected.requestIds.map(async (requestId) => ({
          requestId,
          result: record(await ctx.read.appResult(requestId)),
        })),
      );
      const resultFacts = (accepted: Record<string, unknown>) =>
        Array.isArray(accepted.facts) ? accepted.facts.map(String) : [];
      const exactReturns = candidates.filter(({ result: accepted }) => {
        const facts = resultFacts(accepted);
        return (
          facts.includes(`subject:${selected.appId}/${selected.taskId}`) &&
          facts.includes(`subject-generation:${selected.generation}`) &&
          facts.includes(`evidence-hash:${selected.evidenceHash}`)
        );
      });
      const exactRefusals = candidates.filter(({ result: accepted }) => {
        const facts = resultFacts(accepted);
        return (
          facts.includes("review-disposition:insufficient-evidence") &&
          facts.includes(`subject:${selected.appId}/${selected.taskId}`) &&
          facts.includes(
            `requested-subject-generation:${selected.generation}`,
          ) &&
          facts.includes(`requested-evidence-hash:${selected.evidenceHash}`)
        );
      });
      if (exactReturns.length === 0 && exactRefusals.length === 0) {
        const summary =
          "Verified adoption is retained; waiting for the exact pinned independent review already requested.";
        return ctx.done(summary, {
          state: "waiting",
          summary,
          facts: [
            `activation-result-event:${finished.eventId ?? requestId}`,
            `active-source:${result.sourceCommit}`,
            `new-subject:${selected.appId}/${selected.taskId}:generation-${selected.generation}`,
            `new-subject-evidence:${selected.evidenceHash}`,
          ],
          result: {
            stage: "post-adoption-evaluation-requested",
            packetHash: approvedPacketHash,
            dependencyId: selected.dependencyId,
            newSubject: {
              appId: selected.appId,
              taskId: selected.taskId,
              generation: selected.generation,
              evidenceHash: selected.evidenceHash,
            },
            nextOwner: "app:alex",
            nextAction: "Return the exact pinned independent review.",
          },
        } satisfies TaskReconcileResult);
      }
      if (exactReturns.length === 0) {
        if (exactRefusals.length !== 1)
          throw new Error(
            "post-adoption Evaluation refusal is ambiguous for this owner Task",
          );
        const refusal = exactRefusals[0]!;
        const refusalFacts = resultFacts(refusal.result);
        const actualGeneration =
          refusalFacts.find((fact) => fact.startsWith("actual-generation:")) ??
          "actual-generation:unavailable";
        const actualEvidence =
          refusalFacts.find((fact) =>
            fact.startsWith("actual-evidence-hash:"),
          ) ?? "actual-evidence-hash:unavailable";
        const evaluationReason = String(
          refusal.result.summary ??
            "Evaluation could not read the pinned evidence",
        );
        const summary = `Independent Evaluation finished with insufficient evidence: ${evaluationReason} May must judge whether to select new work or retain this limitation.`;
        return ctx.done(summary, {
          state: "converged",
          summary,
          response: summary,
          facts: [
            `activation-result-event:${finished.eventId ?? requestId}`,
            `active-source:${result.sourceCommit}`,
            `new-subject:${selected.appId}/${selected.taskId}:generation-${selected.generation}`,
            `new-subject-evidence:${selected.evidenceHash}`,
            `follow-up-request:${refusal.requestId}`,
            "review-disposition:insufficient-evidence",
            actualGeneration,
            actualEvidence,
          ],
          result: {
            stage: "post-adoption-evaluation-inconclusive",
            packetHash: approvedPacketHash,
            evaluationDisposition: "insufficient-evidence",
            nextOwner: "app:may",
            nextAction:
              "Judge whether bounded new post-adoption work should be selected; otherwise retain the explicit evidence limitation.",
          },
        } satisfies TaskReconcileResult);
      }
      if (exactReturns.length !== 1)
        throw new Error(
          "post-adoption Evaluation return is ambiguous for this owner Task",
        );
      const admittedRequestId = exactReturns[0]!.requestId;
      const accepted = exactReturns[0]!.result;
      const facts = Array.isArray(accepted.facts)
        ? accepted.facts.map(String)
        : [];
      const disposition =
        facts
          .find((fact) => fact.startsWith("review-disposition:"))
          ?.slice("review-disposition:".length) ?? "unknown";
      const report =
        facts.find((fact) => fact.startsWith("report:")) ??
        "report:unavailable";
      const summary = `Verified adoption and independent post-adoption review are complete (${disposition}). This records follow-up, not a claim of autonomous behavior improvement.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        response: summary,
        facts: [
          `activation-result-event:${finished.eventId ?? requestId}`,
          `active-source:${result.sourceCommit}`,
          `new-subject:${selected.appId}/${selected.taskId}:generation-${selected.generation}`,
          `new-subject-evidence:${selected.evidenceHash}`,
          `follow-up-request:${admittedRequestId}`,
          report,
        ],
        result: {
          stage: "post-adoption-evaluation-complete",
          packetHash: approvedPacketHash,
          evaluationDisposition: disposition,
          nextOwner: "app:may",
          nextAction:
            disposition === "assessed"
              ? "Judge the retained independent findings before claiming value."
              : "Keep the evidence limitation visible; do not claim value.",
        },
      } satisfies TaskReconcileResult);
    }

    if (
      ctx.input.newSubjectTask.appId === "evaluation" ||
      (ctx.input.newSubjectTask.appId === ctx.input.proposal.task.appId &&
        ctx.input.newSubjectTask.taskId === rec.taskId)
    )
      return ctx.blocked(
        "Independent follow-up must target concrete external new work, not Evaluation or the activation owner Task",
      );
    const subjectEvidence = await readSubjectTask(
      {
        appId: ctx.input.newSubjectTask.appId,
        taskId: ctx.input.newSubjectTask.taskId,
      },
      publicRead,
    );
    const subjectEnvelope = record(subjectEvidence.task);
    const subject = record(subjectEnvelope.detail);
    const subjectId = String(subject.taskId ?? subject.id ?? "");
    const activationTime = Number(record(finished.event).timestamp);
    const acceptedAttempt = record(subject.acceptedAttempt);
    // The Host projects the exact attempt that produced the accepted result.
    // Presentation timestamps and unpaired history events cannot establish that
    // work executed after adoption.
    const postActivationOutcome =
      subjectEvidence.disposition === "eligible" &&
      subject.generation === ctx.input.newSubjectTask.generation &&
      subject.status === "up-to-date" &&
      acceptedAttempt.generation === subject.generation &&
      typeof acceptedAttempt.id === "string" &&
      Number.isFinite(Date.parse(String(acceptedAttempt.startedAt))) &&
      Date.parse(String(acceptedAttempt.startedAt)) > activationTime &&
      Boolean(subjectEvidence.evidenceHash);
    if (
      subjectId !== ctx.input.newSubjectTask.taskId ||
      !Number.isFinite(activationTime) ||
      !postActivationOutcome
    )
      return ctx.blocked(
        "Independent follow-up requires bounded readable evidence for an accepted post-activation outcome of the concrete new subject Task",
      );
    const pinnedSubject = {
      ...ctx.input.newSubjectTask,
      evidenceHash: subjectEvidence.evidenceHash!,
    };
    const followUp = {
      id: `post-adoption-review:${approvedPacketHash}:${pinnedSubject.evidenceHash}`,
      appId: "alex" as const,
      input: {
        kind: "review-task-outcome" as const,
        data: {
          appId: pinnedSubject.appId,
          taskId: pinnedSubject.taskId,
          subjectGeneration: pinnedSubject.generation,
          evidenceHash: pinnedSubject.evidenceHash,
        },
      },
    };
    const summary =
      "Actual live source identity matches the approved candidate; waiting for independent Evaluation of the concrete new subject Task.";
    return ctx.done(summary, {
      state: "waiting",
      summary,
      facts: [
        `activation-result-event:${finished.eventId ?? requestId}`,
        `active-source:${result.sourceCommit}`,
        `new-subject:${ctx.input.newSubjectTask.appId}/${subjectId}:generation-${subject.generation}`,
        `new-subject-evidence:${subjectEvidence.evidenceHash}`,
      ],
      result: {
        stage: "post-adoption-evaluation-requested",
        packetHash: approvedPacketHash,
        activationEventId: finished.eventId ?? null,
        dependencyId: followUp.id,
        newSubject: {
          appId: ctx.input.newSubjectTask.appId,
          taskId: subjectId,
          generation: subject.generation,
          evidenceHash: subjectEvidence.evidenceHash,
        },
        nextOwner: "app:alex",
        nextAction: "Independently review the new subject outcome.",
      },
      dependencies: [followUp],
    } satisfies TaskReconcileResult);
  } catch (error) {
    return ctx.blocked(`Activation composition failed: ${String(error)}`);
  }
}

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  return runActivationFollowUp(ctx);
}
