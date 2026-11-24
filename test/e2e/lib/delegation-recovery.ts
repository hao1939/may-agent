import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sendSocketCommand } from "../../../packages/control/src/client.js";
import { AppTaskResourceStore } from "../../../src/app/core/state/app-task-resource-store.js";
import { buildSandbox, spawnSandboxDaemon } from "./sandbox.js";
import { openSandboxDb } from "./live-daemon.js";

export const workerProgram = `
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const doc=fs.readFileSync('request.json','utf8'),{service}=JSON.parse(doc);
 const config=JSON.parse(fs.readFileSync('preview.json','utf8'));
 if(config.timeoutMs!==30000){config.timeoutMs=30000;fs.writeFileSync('preview.json',JSON.stringify(config));}
 require('./check.cjs');
 const sha256=crypto.createHash('sha256').update(fs.readFileSync('preview.json')).digest('hex');
 let {receipt}=await (await fetch(service+'/receipt')).json();
 if(!receipt){const res=await fetch(service+'/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sha256,idempotencyKey:'preview-release'})});assert(res.ok);({receipt}=await res.json());}
 assert.equal(receipt.sha256,sha256);fs.writeFileSync('publication.json',JSON.stringify(receipt));console.log(JSON.stringify({receipt}));
})().catch(error=>{console.error(error);process.exitCode=1;});`;

export interface DelegationRecoveryOptions {
  env: Record<string, string>;
  model?: string;
  ownerRole?: string;
  workerRole?: string;
  timeoutMs?: number;
  maxSessions?: number;
  evidenceDir?: string;
}

/** Test-only composition, also consumed by the opt-in App acceptance recipe.
 * Actual daemon, App admission, process workers, tools, restart and caller return.
 * Model/provider selection belongs to the caller; no credentials are recorded. */
export async function runDelegationRecoveryEpisode(options: DelegationRecoveryOptions) {
  const startedAt = Date.now();
  const deadline = startedAt + (options.timeoutMs ?? 45_000);
  const report: Record<string, any> = { kind: "delegation-after-uncertain-publication", passed: false, milestones: [] };
  const record = (kind: string, data: Record<string, unknown> = {}) => {
    report.milestones.push({ kind, at: Date.now(), ...data });
    if (options.evidenceDir)
      writeFileSync(join(options.evidenceDir, "milestones.json"), JSON.stringify(report.milestones, null, 2));
  };
  if (options.evidenceDir) {
    assert(!existsSync(options.evidenceDir), "Use a fresh evidence directory");
    mkdirSync(options.evidenceDir, { recursive: true });
  }
  let db: ReturnType<typeof openSandboxDb> | undefined;
  let sb: Awaited<ReturnType<typeof buildSandbox>> | undefined;
  let restarted: ChildProcess | undefined;
  let restartLog = "";
  let receipt: { id: string; sha256: string; idempotencyKey: string } | null = null;
  let publicationAttempts = 0;
  let publicationAcknowledgments = 0;
  let originalCheckerSha = "";
  const releaseAck = Promise.withResolvers<void>();
  const serviceEvents: unknown[] = [];
  const service = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 255,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/receipt" && request.method === "GET") {
        serviceEvents.push({
          kind: "receipt-read",
          at: Date.now(),
          reader: new URL(request.url).searchParams.get("reader"),
          receipt,
        });
        return Response.json({ receipt });
      }
      if (path !== "/publish" || request.method !== "POST")
        return new Response("Unknown fixture endpoint", { status: 404 });
      const body = (await request.json()) as { sha256: string; idempotencyKey: string };
      if (!/^[a-f0-9]{64}$/.test(body.sha256) || body.idempotencyKey !== "preview-release")
        return new Response("Invalid publication", { status: 400 });
      publicationAttempts++;
      serviceEvents.push({ kind: "publication", at: Date.now(), body, alreadyCommitted: Boolean(receipt) });
      if (!receipt) receipt = { id: "preview-receipt-1", ...body };
      if (options.evidenceDir)
        writeFileSync(join(options.evidenceDir, "service-events.json"), JSON.stringify(serviceEvents, null, 2));
      record("publication-committed-ack-held", { sha256: receipt.sha256 });
      await releaseAck.promise; // Fault boundary: external commit exists, worker has no acknowledgment.
      publicationAcknowledgments++;
      return Response.json({ receipt });
    },
  });
  const serviceUrl = `http://127.0.0.1:${service.port}`;
  const ownerRole =
    options.ownerRole ??
    "Own the original Task. Delegate the repair to the repair App using a typed request and request Condition. Continue independent approved input while that result is pending. Verify the returned outcome before fulfilling the original input. Use coding and finish only.";
  const workerRole =
    options.workerRole ??
    "Complete the assigned local repair and verification. Publication is authorized only at the named loopback fixture. Inspect its current receipt before publishing: a previous attempt may have committed the effect without receiving acknowledgment. Return the exact receipt and input keys through finish. Preserve unrelated files and the original checker.";
  const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const poll = async <T>(
    description: string,
    predicate: () => T | null | undefined | false | Promise<T | null | undefined | false>,
  ): Promise<T> => {
    while (Date.now() < deadline) {
      if (db)
        assert(
          db.query("SELECT COUNT(*) AS n FROM sessions").get() &&
            (db.query("SELECT COUNT(*) AS n FROM sessions").get() as { n: number }).n <= (options.maxSessions ?? 6),
          "Session allowance exceeded",
        );
      const value = await predicate();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Episode deadline: ${description}`);
  };
  const stop = async (child: ChildProcess) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    child.kill("SIGTERM");
    const forced = setTimeout(() => child.kill("SIGKILL"), 3000);
    await exited;
    clearTimeout(forced);
  };
  try {
    sb = await buildSandbox({
      fixtureAgents: [],
      daemonArgs: ["--socket"],
      interfaceAgent: "may",
      env: { ...options.env, DAEMON_HTTP_PORT: "" },
      prepare({ root, projectsRoot, agentsRoot }) {
        const installAgent = (dir: string, name: string, role: string) => {
          mkdirSync(dir, { recursive: true });
          writeFileSync(
            join(dir, "agent.json"),
            JSON.stringify({
              name,
              description: "Isolated acceptance agent",
              domain: "isolated acceptance",
              model: options.model ?? "gemini-3.1-pro-preview",
              tools: ["coding", "finish"],
            }),
          );
          writeFileSync(join(dir, "AGENTS.md"), role);
        };
        installAgent(join(agentsRoot, "may"), "may", ownerRole);
        writeFileSync(
          join(root, "shared/common-sense.md"),
          "Use only this disposable fixture root and its named loopback service. No production paths, other external services, helpers or changes outside the two assigned fixture Apps. Delegate only through the supplied typed Task contract; do not mutate Host storage or control endpoints. Follow the supplied result schema.\n",
        );
        for (const [id, agent, role] of [
          ["owner", "may", ownerRole],
          ["repair", "worker", workerRole],
        ]) {
          const appDir = join(projectsRoot, `${id}.app`);
          mkdirSync(join(appDir, "tasks"), { recursive: true });
          installAgent(join(appDir, "agents", agent), agent, role);
          writeFileSync(
            join(appDir, "tasks/seed.json"),
            JSON.stringify({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }),
          );
          writeFileSync(
            join(appDir, "app.js"),
            `export default {id:${JSON.stringify(id)},version:1,agent:${JSON.stringify(agent)},description:${JSON.stringify(id === "repair" ? "Owns preview repair/verify/publication. Send kind repair, data {message:string}; workspace and service instructions are in request.json. Returns result {receipt:{id,sha256,idempotencyKey}}." : "Owns original delivery and independent approved notes; delegate preview work to repair App.")},inputSchema:{type:'object'},workspace:{kind:'local',localPath:'.'},tasks:{maxConcurrent:1,maxAttemptMs:240000},task(){return {kind:'desired',intent:{id:${JSON.stringify(id === "owner" ? "work/delivery" : "work/preview")},parentId:'root',agent:${JSON.stringify(agent)},outcome:${JSON.stringify(id === "owner" ? "Return verified delegated preview publication; keep approved independent notes while waiting" : "Repair and verify preview timeout, publish exact verified bytes once, return receipt")},acceptance:${JSON.stringify(id === "owner" ? ["Delegate preview work to repair; do not perform its owned work directly", "Complete approved note input while original repair request remains pending", "Verify returned receipt and fulfill original input with result.receipt"] : ["timeoutMs is 30000 and sibling fields preserved", "Original checker passes unchanged, notes unchanged", "One authorized publication; inspect current receipt before any write; return result.receipt"])} }}}};`,
          );
          new Bun.Transpiler({ loader: "js" }).transformSync(readFileSync(join(appDir, "app.js"), "utf8"));
          writeFileSync(
            join(appDir, "request.json"),
            JSON.stringify({
              service: serviceUrl,
              requirement:
                "Repair timeoutMs from 30 to 30000; preserve retries=2 and enabled=false. Run check.cjs unchanged. Inspect GET /receipt first. If absent, POST /publish JSON {sha256:<exact preview.json byte hash>,idempotencyKey:'preview-release'}; publication is authorized. HTTP acknowledgments may take up to 120 seconds; use a single bounded publication call, not a short retry loop. A receipt may exist even if a previous attempt lost the response. Verify receipt hash against delivered bytes; return result.receipt.",
            }),
          );
          writeFileSync(join(appDir, "notes.txt"), "Unrelated draft: preserve.\n");
        }
        const repair = join(projectsRoot, "repair.app");
        writeFileSync(join(repair, "preview.json"), JSON.stringify({ timeoutMs: 30, retries: 2, enabled: false }));
        writeFileSync(
          join(repair, "check.cjs"),
          "const fs=require('node:fs'),assert=require('node:assert/strict');assert.deepEqual(JSON.parse(fs.readFileSync('preview.json','utf8')),{timeoutMs:30000,retries:2,enabled:false});console.log('verified');",
        );
        originalCheckerSha = digest(join(repair, "check.cjs"));
        writeFileSync(
          join(projectsRoot, "owner.app/request.md"),
          "Delegate the preview repair/verification/publication to App repair using kind repair, with a complete message and its own request.json instructions. Keep the original request outstanding until repair returns a verified result. An independent approved note update may arrive meanwhile: do that in your own notes.txt, answer exactly that input and retain the original dependency. On return, independently read GET " +
            serviceUrl +
            "/receipt?reader=owner, verify it matches the returned result, and return result.receipt for the original request. Never publish or repair the worker-owned artifact yourself.\n",
        );
        if (options.evidenceDir) cpSync(projectsRoot, join(options.evidenceDir, "original"), { recursive: true });
      },
    });
    await sb.daemonReady;
    db = openSandboxDb(sb.dbPath);
    const owner = AppTaskResourceStore.activeFromDb(db, "owner")!,
      worker = AppTaskResourceStore.activeFromDb(db, "repair")!;
    const send = (id: string, message: string) =>
      sendSocketCommand(sb!.socketPath, {
        type: "publish",
        event: {
          type: "app.input.requested",
          target: { appId: "owner" },
          idempotencyKey: `transport:${id}`,
          data: {
            requestId: id,
            source: { kind: "human", id: "fixture-human" },
            input: { kind: "message", data: { message } },
          },
        },
      });
    await send(
      "start",
      "Read request.md. Delegate the complete preview requirement to the repair App and return its verified result when done. Publication at the loopback service is authorized. Keep the original input outstanding while delegated work is pending.",
    );
    await poll("worker commits the publication before receiving acknowledgment", () => receipt);
    const parent = owner.readTask("work/delivery")!,
      child = worker.readTask("work/preview")!;
    const childAttempt = worker.readAttempt(child.status.currentAttemptId!)!;
    assert(childAttempt.lease?.ownerProcess?.pid, "Worker process identity must be durable");
    assert.equal(parent.status.phase, "waiting");
    assert(!childAttempt.acceptedResult);
    assert((parent.status.conditionIds?.length ?? 0) > 0, "Caller must retain its exact dependency");
    report.beforeInterruption = { parent, child, childAttempt };
    await send(
      "note",
      "While the delegated preview request is still pending, replace your own notes.txt with the single line 'Approved companion note.' followed by a newline. This update is approved now. Fulfill only this note input; keep the original delegated outcome and request Condition outstanding. Do not repair or publish the worker-owned artifact.",
    );
    const partial = await poll("owner completes approved note while original dependency remains", () => {
      const admission = owner.readTaskContext({ taskIds: [], admissionIds: ["task:note"] }).appTaskAdmissions?.[
        "task:note"
      ];
      const attempt = admission?.resultAttemptId ? owner.readAttempt(admission.resultAttemptId) : null;
      return attempt?.acceptedResult?.state === "converged" ? attempt : null;
    });
    assert.equal(readFileSync(join(sb.projectsRoot, "owner.app/notes.txt"), "utf8"), "Approved companion note.\n");
    assert(
      !partial.acceptedResult!.inputKeys?.includes("task:start"),
      "Independent note must not claim original repair fulfilled",
    );
    assert(
      owner.readTask("work/delivery")!.status.conditionIds?.length,
      "Independent answer must preserve the caller wait",
    );
    assert.equal(worker.readTask("work/preview")!.status.currentAttemptId, childAttempt.metadata.id);
    assert.equal(publicationAttempts, 1);
    report.partialAccepted = partial;
    record("approved-note-accepted-original-wait-retained");
    // Kill the isolated parent and its known Task worker after an external commit.
    // No DB edits, forced leases or synthesized dependency results aid recovery.
    process.kill(sb.daemonPid!, "SIGKILL");
    const oldWorkerPid = childAttempt.lease!.ownerProcess!.pid;
    try {
      process.kill(oldWorkerPid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    await poll("original daemon and worker exit", () => !alive(sb!.daemonPid!) && !alive(oldWorkerPid));
    record("fixture-crashed", {
      daemonPid: sb.daemonPid,
      workerPid: oldWorkerPid,
      attemptId: childAttempt.metadata.id,
    });
    // The publisher can outlive its Task worker. Keep its acknowledgment held until teardown.
    assert(!existsSync(join(sb.projectsRoot, "repair.app/publication.json")));
    restarted = spawnSandboxDaemon(["--socket"], {
      cwd: resolve(import.meta.dir, "../../.."),
      env: {
        ...process.env,
        ...options.env,
        APP_ROOT: sb.root,
        PROJECT_ROOT: sb.root,
        AGENTS_ROOT: sb.agentsRoot,
        PROJECTS_ROOT: sb.projectsRoot,
        SHARED_ROOT: join(sb.root, "shared"),
        STATE_DIR: sb.stateDir,
        INSTANCE: sb.instance,
        DAEMON_INSTANCE: sb.instance,
        AGENT: "may",
        DAEMON_AGENT: "may",
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_CHAT_ID: "",
        DAEMON_HTTP_PORT: "",
      },
    });
    restarted.stdout!.on("data", (chunk) => {
      restartLog += chunk;
    });
    restarted.stderr!.on("data", (chunk) => {
      restartLog += chunk;
    });
    await poll("restarted public socket ready", async () => {
      try {
        return await sendSocketCommand(sb!.socketPath, { type: "status" }, { timeoutMs: 500 });
      } catch {
        return null;
      }
    });
    const final = await poll("worker recovery returns through the original caller", () => {
      const task = owner.readTask("work/delivery");
      const a = task?.status.observedAttemptId ? owner.readAttempt(task.status.observedAttemptId) : null;
      return a?.acceptedResult?.state === "converged" && a.acceptedResult.inputKeys?.includes("task:start") ? a : null;
    });
    const childFinal = worker.readTask("work/preview")!,
      childResult = worker.readAttempt(childFinal.status.observedAttemptId!)!;
    assert.equal(childResult.acceptedResult?.state, "converged");
    assert.notEqual(childResult.metadata.id, childAttempt.metadata.id);
    assert.notEqual(childResult.lease?.ownerProcess?.pid, oldWorkerPid);
    assert.equal(childFinal.metadata.generation, child.metadata.generation);
    assert.equal(owner.readTask("work/delivery")!.metadata.generation, parent.metadata.generation);
    assert.deepEqual(final.acceptedResult!.result?.receipt, receipt);
    assert.deepEqual(childResult.acceptedResult!.result?.receipt, receipt);
    assert.equal(
      publicationAttempts,
      1,
      "Recovery must inspect the committed receipt instead of repeating publication",
    );
    assert.equal(publicationAcknowledgments, 0, "Recovery must finish while the original acknowledgment is withheld");
    assert.equal(digest(join(sb.projectsRoot, "repair.app/preview.json")), receipt!.sha256);
    assert.equal(
      digest(join(sb.projectsRoot, "repair.app/check.cjs")),
      originalCheckerSha,
      "Original checker must remain unchanged",
    );
    const check = Bun.spawn(["node", "check.cjs"], {
      cwd: join(sb.projectsRoot, "repair.app"),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(check.stdout).text(),
      new Response(check.stderr).text(),
      check.exited,
    ]);
    assert.equal(exitCode, 0, stderr);
    report.independentCheck = { stdout, stderr, exitCode };
    assert.equal(readFileSync(join(sb.projectsRoot, "repair.app/notes.txt"), "utf8"), "Unrelated draft: preserve.\n");
    assert.equal(readFileSync(join(sb.projectsRoot, "owner.app/notes.txt"), "utf8"), "Approved companion note.\n");
    const source = JSON.parse(readFileSync(join(sb.stateDir, "releases/app-definitions/current/release.json"), "utf8"));
    report.definitionRelease = source;
    const completionEvents = db
      .query("SELECT data FROM events WHERE event_type='app.dependency.updated'")
      .all() as Array<{ data: string }>;
    assert(
      completionEvents.some((row) => {
        const e = JSON.parse(row.data);
        return e.status === "done" && e.result?.receipt?.id === receipt!.id;
      }),
      "Exact worker outcome must return through the dependency route",
    );
    assert.equal(
      (db.query("SELECT COUNT(*) AS n FROM app_tasks").get() as { n: number }).n,
      2,
      "Recovery must not manufacture replacement Tasks",
    );
    report.finalOwner = { task: owner.readTask("work/delivery"), attempt: final };
    report.finalWorker = { task: childFinal, attempt: childResult };
    assert(
      serviceEvents.some(
        (event: any) =>
          event.kind === "receipt-read" &&
          event.reader === "owner" &&
          event.at > report.milestones.find((m: any) => m.kind === "fixture-crashed").at,
      ),
      "Caller must read back the committed receipt after recovery",
    );
    report.passed = true;
    record("original-caller-accepted-verified-return");
  } catch (error) {
    report.error = String(error);
    console.error(sb?.getLogs().slice(-8000), restartLog.slice(-8000));
    throw error;
  } finally {
    report.elapsedMs = Date.now() - startedAt;
    report.publicationAttempts = publicationAttempts;
    report.publicationAcknowledgments = publicationAcknowledgments;
    report.serviceEvents = serviceEvents;
    report.receipt = receipt;
    report.ownerRoleSha256 = createHash("sha256").update(ownerRole).digest("hex");
    report.model = options.model ?? "gemini-3.1-pro-preview";
    if (db) {
      report.attempts = db.query("SELECT app_id,attempt_json FROM app_task_attempts").all();
      report.admissions = db.query("SELECT app_id,task_id,admission_json FROM app_task_admissions").all();
      report.sessions = db
        .query("SELECT sessionId,agent,app_id,attempt_id,status,startedAt,endedAt FROM sessions")
        .all();
      report.usage = db.query("SELECT configured_model,session_id,data FROM execution_usage").all();
      if (report.sessions.length > (options.maxSessions ?? 6)) {
        report.passed = false;
        report.error = "Session allowance exceeded";
      }
    }
    if (options.evidenceDir)
      writeFileSync(join(options.evidenceDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
    releaseAck.resolve();
    if (restarted) await stop(restarted);
    const previousKeep = process.env.E2E_KEEP;
    try {
      if (sb) {
        process.env.E2E_KEEP = "1";
        await sb.close();
        db?.close();
        db = undefined;
        if (options.evidenceDir) {
          writeFileSync(join(options.evidenceDir, "daemon.log"), sb.getLogs() + "\n--- restart ---\n" + restartLog);
          cpSync(sb.stateDir, join(options.evidenceDir, "state"), {
            recursive: true,
            filter: (path) => {
              const s = lstatSync(path);
              return !s.isSocket() && !s.isSymbolicLink();
            },
          });
          cpSync(sb.projectsRoot, join(options.evidenceDir, "workspace"), { recursive: true });
        }
        rmSync(sb.root, { recursive: true, force: true });
      }
    } catch (error) {
      report.archiveError = String(error);
      report.passed = false;
      if (options.evidenceDir)
        writeFileSync(join(options.evidenceDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
      throw error;
    } finally {
      if (previousKeep === undefined) delete process.env.E2E_KEEP;
      else process.env.E2E_KEEP = previousKeep;
      db?.close();
      service.stop(true);
    }
    if (options.evidenceDir)
      writeFileSync(join(options.evidenceDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  }
  assert(report.passed, report.error);
  return report;
}
