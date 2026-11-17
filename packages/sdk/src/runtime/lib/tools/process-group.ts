import { readdirSync, readFileSync } from "node:fs";

// Shared command cleanup must load without the agent/tool runtime dependencies.
export const BASH_PROCESS_GROUP_TERM_GRACE_MS = 250;
export const BASH_PROCESS_GROUP_KILL_GRACE_MS = 1_000;
export const PROCESS_GROUP_POLL_MS = 20;

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function processGroupExists(pgid: number): boolean {
	try {
		process.kill(-pgid, 0);
		return true;
	} catch {
		return false;
	}
}

export function processGroupContainsLiveMember(
	pgid: number,
	entries: Iterable<string>,
	readStat: (pid: string) => string = (pid) => readFileSync(`/proc/${pid}/stat`, "utf8"),
): boolean {
	for (const entry of entries) {
		if (!/^\d+$/.test(entry)) continue;
		try {
			const stat = readStat(entry);
			const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
			if (Number(fields[2]) === pgid && fields[0] !== "Z") return true;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			// A process may exit between readdir and read. It cannot still be a
			// live member of this group; keep inspecting the remaining entries.
			if (code === "ENOENT" || code === "ESRCH") continue;
			return true;
		}
	}
	return false;
}

export function processGroupAlive(pgid: number): boolean {
	if (!processGroupExists(pgid)) return false;
	// kill(0) includes unreaped zombies. On Linux, regard a zombie-only group as
	// drained so settlement and recovery do not wait on an unrelated reaper.
	try {
		return processGroupContainsLiveMember(pgid, readdirSync("/proc"));
	} catch {
		return true;
	}
}

async function waitForProcessGroupFormation(pgid: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (!processGroupExists(pgid) && processExists(pgid) && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, PROCESS_GROUP_POLL_MS));
	}
	return processGroupExists(pgid);
}

export function signalProcessGroup(pgid: number, signal: "SIGTERM" | "SIGKILL"): void {
	try {
		process.kill(-pgid, signal);
	} catch {
		// The exact process group already exited.
	}
}

async function waitForProcessGroupExit(pgid: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	// The kernel group probe is cheap. Walking every process in /proc on every
	// 20ms poll is not: on a busy Host one command settlement generated
	// hundreds of thousands of reads. Inspect members once at the phase
	// boundary only, where it is needed to distinguish live processes from a
	// zombie-only group.
	while (processGroupExists(pgid) && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, PROCESS_GROUP_POLL_MS));
	}
	return !processGroupExists(pgid) || !processGroupContainsLiveMember(pgid, readdirSync("/proc"));
}

/** Drain one exact setsid group before allowing its bash tool call to settle. */
export async function drainBashProcessGroup(pgid: number): Promise<boolean> {
	// spawn() exposes the future setsid leader PID before /usr/bin/setsid has
	// necessarily created the process group. An immediate abort must wait for
	// that tiny fork/exec window; otherwise a negative-PID probe can report
	// ESRCH and let the command start after its tool call has already settled.
	if (!processGroupExists(pgid) && processExists(pgid)) {
		const formed = await waitForProcessGroupFormation(pgid, BASH_PROCESS_GROUP_TERM_GRACE_MS);
		if (!formed) {
			try {
				process.kill(pgid, "SIGKILL");
			} catch {
				// The pre-setsid leader exited without creating the group.
			}
			// Close the last formation race: if setsid won just before the
			// positive-PID kill, drain the newly created group as well.
			if (processGroupExists(pgid)) signalProcessGroup(pgid, "SIGKILL");
			return waitForProcessGroupExit(pgid, BASH_PROCESS_GROUP_KILL_GRACE_MS);
		}
	}
	// A signal to a zombie-only group is harmless. Avoid an eager /proc walk;
	// the phase-boundary check below will distinguish zombies if the cheap
	// kernel probe continues to report the group.
	if (!processGroupExists(pgid)) return true;
	signalProcessGroup(pgid, "SIGTERM");
	if (await waitForProcessGroupExit(pgid, BASH_PROCESS_GROUP_TERM_GRACE_MS)) return true;
	signalProcessGroup(pgid, "SIGKILL");
	return waitForProcessGroupExit(pgid, BASH_PROCESS_GROUP_KILL_GRACE_MS);
}

